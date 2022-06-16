'''
Author: MondayCha
Date: 2022-04-30 22:53:59
Description: Get Map-Matching SDK Result
'''
from flask import request, current_app
from api.models.coordinate import Coordinate, TimestampCoordinate
from api.models.data_group import DataGroup
from api.utils.matching_sdk import matching_for_data
from app import db, hashids
from flasgger import swag_from
from flask_jwt_extended import jwt_required, current_user

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *
from api.utils.trajectory import get_bounds

# System
import os
import json

from . import bp


@bp.route('/matchings/<group_hashid>/<data_name>', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'tarj info',
        }
    }
})
def get_data_map_matching(group_hashid, data_name):
    """
    Get data map-matching result
    ---  
    """
    if request.method == 'GET':
        if group_hashid is None or data_name is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            group_id = hashids.decode(group_hashid)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')

        json_file_path = os.path.join(get_matching_path(group_id), '%s.json' % data_name)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'matching for data not found')
        
        matching_detail = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/trajs]: %s' % matching_detail['traj_name'])

        return good_request(matching_detail)
    return bad_request()


@bp.route('/matching', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'tarj info',
        }
    }
})
@jwt_required()
def map_matching():
    """
    Get data map-matching result
    ---  
    """
    if request.method == 'POST':
        req_group_hashid = request.form.get('group_hashid')
        req_data_name = request.form.get('data_name')
        req_raw_traj = request.form.get('raw_traj')
        if req_group_hashid is None or req_raw_traj is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            group_id = hashids.decode(req_group_hashid)[0]
            current_group = DataGroup.query.get(group_id)
            osm_path = current_group.osm_path
            raw_traj = json.loads(req_raw_traj)
            way_points = raw_traj['path']
            input_path, output_path, matching_path = create_user_modify_folder(current_user.id)
            input_traj_name = req_data_name
            f = open(os.path.join(input_path, input_traj_name), 'w')
            str = ''
            if group_id == 1:
                for way_point in way_points:
                    str += '%s\t%s\t%s\n' % (way_point['coordinates'][0],way_point['coordinates'][1], way_point['timestamp'])
            else:
                for way_point in way_points:
                    str += '%s,%s,%s\n' % (way_point['coordinates'][0],way_point['coordinates'][1], way_point['timestamp'])
            f.write(str)
            f.close()
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal group id')
            
        if group_id == 1:
            data_id = req_data_name.split('.')[0]   # 00000000
            arcs_path = os.path.join(osm_path, data_id, '%s.arcs' % data_id)
            nodes_path = os.path.join(osm_path, data_id, '%s.nodes' % data_id)
            track_path = os.path.join(input_path, input_traj_name)
            loading_cmd = 'java -cp %s com.example.ImportMatchingDataset --graphHopperLocation=/tmp/lowlevel-graph %s %s' % (current_app.config.get('SDK_IEEE_PATH'), nodes_path, arcs_path)
            matching_code, matching_dict = cmd(loading_cmd)
            if matching_code == 1:
                current_app.logger.debug(matching_dict['stderr'])
            matching_methods = current_app.config.get('MATCHING_METHODS')
            for matching_method in matching_methods:
                id_output_path = os.path.join(output_path, '%s-%s.track' % (matching_method, data_id))
                running_cmd = 'java -cp %s com.example.RunMatchingDataset --graphHopperLocation=/tmp/lowlevel-graph --matcher %s --output=%s %s' % (current_app.config.get('SDK_IEEE_PATH'), matching_method, id_output_path, track_path)
                matching_code, matching_dict = cmd(running_cmd)
                current_app.logger.debug('[IEEE] %s: %s' % (matching_method, data_id))
                if matching_code == 1:
                    current_app.logger.debug('[Matching]', matching_dict['stderr'])
                    continue
        else:
            matching_sdk_code, matching_sdk_dict = matching_for_data(osm_path, input_path, output_path)
            if matching_sdk_code == 1:
                return bad_request(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,ret_status_code=RETStatus.SDK_ERR, detail=matching_sdk_dict)

        matching_method_names = current_app.config.get('MATCHING_METHODS')
        success_matching_time = 0
        multiple_matching_list = []
        for method_name in matching_method_names:
            matching_method_path = os.path.join(output_path, "%s-%s" % (method_name, input_traj_name))
            if os.path.exists(matching_method_path):
                try:
                    matching_result: list[Coordinate] = []
                    with open(matching_method_path, 'r') as f:
                        for line in f:
                            line_list = line.replace('\n', '').strip().split(' ')
                            if len(line_list) != 2:
                                continue
                            matching_result.append(Coordinate(line_list[0], line_list[1]))
                        f.close()
                    multiple_matching_list.append({
                        'method_name': method_name,
                        'trajectory': [result.to_dict() for result in matching_result]
                    })
                except Exception:
                    current_app.logger.error('[Matching] Unable to read: %s' % matching_method_path)
                    continue
                success_matching_time += 1
        
        if success_matching_time < 2:
            return bad_request(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,ret_status_code=RETStatus.SDK_ERR, detail='matching failed')
        
        modify_traj = [TimestampCoordinate(way_point['coordinates'][0], way_point['coordinates'][1], way_point['timestamp'])\
            for way_point in way_points]

        multiple_matching_dict = {
            'group_id': req_group_hashid,
            'traj_name': input_traj_name,
            'bounds': get_bounds(modify_traj),
            'raw_traj': [result.to_dict() for result in modify_traj],
            'matching_result': multiple_matching_list
        }

        # Write Coordinates
        with open(os.path.join(matching_path, '%s.json' % input_traj_name), 'w') as f:
            json.dump(multiple_matching_dict, f)
            f.close()

        return good_request(multiple_matching_dict)
    return bad_request()