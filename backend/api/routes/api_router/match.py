import json
import os
from datetime import datetime
from flask import request, g, current_app
from werkzeug.utils import secure_filename
from api.models.coordinate import Coordinate, TimestampCoordinate
from api.models.task import Task
from api.models.trajectory import MatchingMethod, Trajectory
from api.utils.matching_sdk import matching_sdk
from api.utils.os_helper import *
from api.utils.request_handler import *
from app import db
from flasgger import swag_from

from . import bp

def get_bounds(coordinates):
    min_lat = min_lon = max_lat = max_lon = None
    for coordinate in coordinates:
        if min_lat is None or coordinate.latitude < min_lat:
            min_lat = coordinate.latitude
        if min_lon is None or coordinate.longitude < min_lon:
            min_lon = coordinate.longitude
        if max_lat is None or coordinate.latitude > max_lat:
            max_lat = coordinate.latitude
        if max_lon is None or coordinate.longitude > max_lon:
            max_lon = coordinate.longitude
    return [[float(min_lon), float(min_lat)], [float(max_lon), float(max_lat)]]


@bp.route('/match', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'map matching',
        }
    }
})
def multiple_matching():
    """
    Map matching
    """
    if request.method == 'POST':
        time_start = datetime.now()
        # get all params and formdata
        req_upload_files = request.files.getlist('files')

        # create task folder
        new_task = Task()
        db.session.add(new_task)
        db.session.commit()
        g.task = new_task
        task_hashid = current_app.hashids.encode(new_task.id)
        create_task_folder(new_task.id)
        input_path = get_input_path(new_task.id)
        output_path = get_output_path(new_task.id)

        # store files
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
        matching_sdk_code, matching_sdk_dict = matching_sdk()
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
            with open(os.path.join(get_input_path(new_task.id), trajectory.name), 'r') as f:
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
                'task_id': task_hashid,
                'traj_name': trajectory.name,
                'bounds': get_bounds(trajectory.raw_traj),
                'raw_traj': [result.to_dict() for result in trajectory.raw_traj],
                'matching_result': multiple_matching_list
            }

            # Write Coordinates
            with open(os.path.join(get_matching_path(new_task.id), '%s.json' % trajectory.name), 'w') as f:
                json.dump(multiple_matching_dict, f)
                f.close()

        # Write to disk
        request_detail = {
            'task_id': task_hashid,
            'matching_result': {
                'success': [ traj.name for traj in success_trajectory_list ],
                'failed': [ traj.name for traj in failed_trajectory_list ]
            },
        }

        with open(os.path.join(current_app.config['UPLOAD_DIR'], str(new_task.id), '%s.json' % new_task.id), 'w') as f:
            json.dump(request_detail, f)
            f.close()

        return good_request(detail=request_detail)
