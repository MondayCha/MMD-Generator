import json
import os
from datetime import datetime
from flask import request, g, current_app
from werkzeug.utils import secure_filename
from api.models.coordinate import Coordinate, TimestampCoordinate
from api.models.data_group import DataGroup
from api.models.data import Data
from api.models.trajectory import MatchingMethod, Trajectory
from api.utils.matching_sdk import matching_for_group
from api.utils.os_helper import *
from api.utils.request_handler import *
from api.utils.trajectory import get_bounds
from app import db
from flasgger import swag_from
from flask_jwt_extended import jwt_required

from . import bp


@bp.route('/data_groups', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'Create New Data Group',
        }
    }
})
@jwt_required()
def data_group():
    """
    Create New Data Group
    - Save datas to file system
    - Call matching sdk
    - Create new data group in database
    ---
    """
    if request.method == 'POST':
        # get all params and formdata
        req_upload_files = request.files.getlist('files')

        # create data group folder
        new_group = DataGroup(osm_path=current_app.config.get('OSM_FILE_PATH'))
        db.session.add(new_group)
        db.session.commit()
        g.group = new_group
        group_hashid = current_app.hashids.encode(new_group.id)
        create_data_group_folder(new_group.id)
        input_path = get_input_path(new_group.id)
        output_path = get_output_path(new_group.id)

        # store input files
        trajectory_list: list[Trajectory] = []
        for file in req_upload_files:
            try:
                secure_name = secure_filename(file.filename)
                file_path = os.path.join(input_path, secure_name)
                file.save(file_path)
                trajectory_list.append(Trajectory(secure_name, file_path))
            except Exception:
                current_app.logger.error('Unable to save: %s' % file.filename)
                continue

        # call sdk for map-matching
        time_start_map_matching = datetime.now()
        matching_sdk_code, matching_sdk_dict = matching_for_group(new_group.osm_path)
        if matching_sdk_code == 1:
            return bad_request(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,ret_status_code=RETStatus.SDK_ERR, detail=matching_sdk_dict)
        
        matching_method_names = current_app.config.get('MATCHING_METHODS')
        success_trajectory_list: list[Trajectory] = []
        failed_trajectory_list: list[Trajectory] = []
        for trajectory in trajectory_list:
            success_matching_time = 0
            for method_name in matching_method_names:
                matching_method_path = os.path.join(output_path, "%s-%s" % (method_name, trajectory.name))
                if os.path.exists(matching_method_path):
                    trajectory.matching_method_dict[method_name] = MatchingMethod(method_name, matching_method_path)
                    success_matching_time += 1
            if success_matching_time >= 2:
                trajectory.success = True
                success_trajectory_list.append(trajectory)
            else:
                failed_trajectory_list.append(trajectory)
        
        time_end_map_matching = datetime.now()
        current_app.logger.info('Map matching time: %s' % (time_end_map_matching - time_start_map_matching).seconds)

        for trajectory in success_trajectory_list:
            lcss_method_names: list[str] = []
            lcss_inputs: list[list[Coordinate]] = []
            lcss_dicts: list[dict] = []

            # Read raw GPS trajectory
            # |-------------|-----------|------------|
            # | longitude   | latitude  | timestamp  |
            # |-------------|-----------|------------|
            # | 116.33073   | 39.97568  | 1183524462 |
            # |-------------|-----------|------------|
            with open(os.path.join(get_input_path(new_group.id), trajectory.name), 'r') as f:
                for line in f:
                    line_list = line.replace('\n', '').strip().split(',')
                    if len(line_list) != 3:
                        current_app.logger.error('[%s] Invalid raw line: %s' % (trajectory.name, line))
                        continue
                    trajectory.raw_traj.append(TimestampCoordinate(line_list[0], line_list[1], line_list[2]))
                f.close()

            # Read Coordinates for each matching method
            for matching_method in trajectory.matching_method_dict.values():
                lcss_input : list[Coordinate] = []
                try:
                    with open(matching_method.path, 'r') as f:
                        for line in f:
                            line_list = line.replace('\n', '').strip().split(' ')
                            if len(line_list) != 2:
                                continue
                            lcss_input.append(Coordinate(line_list[0], line_list[1]))
                        f.close()
                    lcss_method_names.append(matching_method.name)
                    lcss_inputs.append(lcss_input)
                    matching_method.raw_traj = lcss_input
                except Exception:
                    current_app.logger.error('[LCSS] Unable to read: %s' % matching_method.path)
                    continue
            
            multiple_matching_list = []
            for i in range(0, len(lcss_method_names)):
                multiple_matching_list.append({
                    'method_name': lcss_method_names[i],
                    'trajectory': [result.to_dict() for result in lcss_inputs[i]]
                })

            multiple_matching_dict = {
                'group_id': group_hashid,
                'traj_name': trajectory.name,
                'bounds': get_bounds(trajectory.raw_traj),
                'raw_traj': [result.to_dict() for result in trajectory.raw_traj],
                'matching_result': multiple_matching_list
            }

            # Write Coordinates
            with open(os.path.join(get_matching_path(new_group.id), '%s.json' % trajectory.name), 'w') as f:
                json.dump(multiple_matching_dict, f)
                f.close()
            
            # Save to database
            new_success_data = Data(name=trajectory.name, path=trajectory.path, group_id=new_group.id, status=1)
            db.session.add(new_success_data)
            db.session.commit()

        for trajectory in failed_trajectory_list:
            new_failed_data = Data(name=trajectory.name, path=trajectory.path, group_id=new_group.id, status=0)
            db.session.add(new_failed_data)
            db.session.commit()

        # Write to disk
        request_detail = {
            'group_id': group_hashid,
            'matching_result': {
                'success': [ traj.name for traj in success_trajectory_list ],
                'failed': [ traj.name for traj in failed_trajectory_list ]
            },
        }

        with open(os.path.join(get_data_group_path(new_group.id), '%s.json' % new_group.id), 'w') as f:
            json.dump(request_detail, f)
            f.close()

        return good_request(detail=request_detail)


@bp.route('/data_groups/<group_hashid>', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'data group',
        }
    }
})
@jwt_required()
def get_data_group(group_hashid):
    """
    Get Group Brief Information
    ---
    parameters:
      - in: path
        name: group_hashid
        required: true
        description: group hash id
        schema:  
            type: string
    tags:
      - api
    """
    if request.method == 'GET':

        if group_hashid is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            group_id = current_app.hashids.decode(group_hashid)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')

        json_file_path = os.path.join(get_data_group_path(group_id), '%s.json' % group_id)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'tarj not found')
        
        data_group_info = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/data_groups/%s]: %s' % (group_hashid, group_id))

        return good_request(data_group_info)
    return bad_request()


@bp.route('/data_group_ieee', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'Create New Data Group',
        }
    }
})
@jwt_required()
def data_group_ieee():
    """
    IEEE 2015
    - https://zenodo.org/record/57731
    ---
    """
    if request.method == 'POST':
        # create data group folder
        new_group = DataGroup(osm_path=current_app.config.get('IEEE_2015_PATH'))
        db.session.add(new_group)
        db.session.commit()
        g.group = new_group
        group_hashid = current_app.hashids.encode(new_group.id)
        create_data_group_folder(new_group.id)
        input_path = get_input_path(new_group.id)
        output_path = get_output_path(new_group.id)

        # call sdk for map-matching
        matching_methods = current_app.config.get('MATCHING_METHODS')
        trajectory_list = []
        for root, dirs, _ in os.walk(new_group.osm_path):
            for id in dirs:
                arcs_path = os.path.join(root, id, '%s.arcs' % id)
                nodes_path = os.path.join(root, id, '%s.nodes' % id)
                track_path = os.path.join(root, id, '%s.track' % id)
                trajectory_list.append(Trajectory('%s.track' % id, track_path))
                for matching_method in matching_methods:
                    loading_cmd = 'java -cp %s com.example.ImportMatchingDataset --graphHopperLocation=/tmp/lowlevel-graph %s %s' % (current_app.config.get('SDK_IEEE_PATH'), nodes_path, arcs_path)
                    matching_code, matching_dict = cmd(loading_cmd)
                    current_app.logger.debug('[IEEE] %s: %s' % (matching_method, matching_code))
                    if matching_code == 1:
                        current_app.logger.debug(matching_dict['stderr'])
                        continue
                    id_output_path = os.path.join(output_path, '%s-%s.track' % (matching_method, id))
                    running_cmd = 'java -cp %s com.example.RunMatchingDataset --graphHopperLocation=/tmp/lowlevel-graph --matcher %s --output=%s %s' % (current_app.config.get('SDK_IEEE_PATH'), matching_method, id_output_path, track_path)
                    matching_code, matching_dict = cmd(running_cmd)
                    if matching_code == 1:
                        current_app.logger.debug('[Matching]', matching_dict['stderr'])
                        continue
        
        current_app.logger.debug('[IEEE] trajectory_list %s' % trajectory_list)
        matching_method_names = current_app.config.get('MATCHING_METHODS')
        success_trajectory_list: list[Trajectory] = []
        failed_trajectory_list: list[Trajectory] = []
        for trajectory in trajectory_list:
            success_matching_time = 0
            for method_name in matching_method_names:
                matching_method_path = os.path.join(output_path, "%s-%s" % (method_name, trajectory.name))
                if os.path.exists(matching_method_path):
                    trajectory.matching_method_dict[method_name] = MatchingMethod(method_name, matching_method_path)
                    success_matching_time += 1
            if success_matching_time >= 2:
                trajectory.success = True
                success_trajectory_list.append(trajectory)
            else:
                failed_trajectory_list.append(trajectory)

        for trajectory in success_trajectory_list:
            lcss_method_names: list[str] = []
            lcss_inputs: list[list[Coordinate]] = []
            lcss_dicts: list[dict] = []

            # Read raw GPS trajectory
            # |-------------|-----------|------------|
            # | longitude   | latitude  | timestamp  |
            # |-------------|-----------|------------|
            # | 116.33073   | 39.97568  | 1183524462 |
            # |-------------|-----------|------------|
            with open(trajectory.path, 'r') as f:
                for line in f:
                    line_list = line.replace('\n', '').strip().split('\t')
                    if len(line_list) != 3:
                        current_app.logger.error('[%s] Invalid raw line: %s' % (trajectory.name, line))
                        continue
                    trajectory.raw_traj.append(TimestampCoordinate(line_list[0], line_list[1], line_list[2]))
                f.close()

            # Read Coordinates for each matching method
            for matching_method in trajectory.matching_method_dict.values():
                lcss_input : list[Coordinate] = []
                try:
                    with open(matching_method.path, 'r') as f:
                        for line in f:
                            line_list = line.replace('\n', '').strip().split(' ')
                            if len(line_list) != 2:
                                continue
                            lcss_input.append(Coordinate(line_list[0], line_list[1]))
                        f.close()
                    lcss_method_names.append(matching_method.name)
                    lcss_inputs.append(lcss_input)
                    matching_method.raw_traj = lcss_input
                except Exception:
                    current_app.logger.error('[LCSS] Unable to read: %s' % matching_method.path)
                    continue
            
            multiple_matching_list = []
            for i in range(0, len(lcss_method_names)):
                multiple_matching_list.append({
                    'method_name': lcss_method_names[i],
                    'trajectory': [result.to_dict() for result in lcss_inputs[i]]
                })

            multiple_matching_dict = {
                'group_id': group_hashid,
                'traj_name': trajectory.name,
                'bounds': get_bounds(trajectory.raw_traj),
                'raw_traj': [result.to_dict() for result in trajectory.raw_traj],
                'matching_result': multiple_matching_list
            }

            # Write Coordinates
            with open(os.path.join(get_matching_path(new_group.id), '%s.json' % trajectory.name), 'w') as f:
                json.dump(multiple_matching_dict, f)
                f.close()
            
            # Save to database
            new_success_data = Data(name=trajectory.name, path=trajectory.path, group_id=new_group.id, status=1)
            db.session.add(new_success_data)
            db.session.commit()

        for trajectory in failed_trajectory_list:
            new_failed_data = Data(name=trajectory.name, path=trajectory.path, group_id=new_group.id, status=0)
            db.session.add(new_failed_data)
            db.session.commit()

        # Write to disk
        request_detail = {
            'group_id': group_hashid,
            'matching_result': {
                'success': [ traj.name for traj in success_trajectory_list ],
                'failed': [ traj.name for traj in failed_trajectory_list ]
            },
        }

        with open(os.path.join(get_data_group_path(new_group.id), '%s.json' % new_group.id), 'w') as f:
            json.dump(request_detail, f)
            f.close()

        return good_request(detail=request_detail)