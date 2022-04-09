import json
import os
from flask import request, g, current_app
from werkzeug.utils import secure_filename
from api.models.coordinate import Coordinate
from api.models.task import Task
from api.models.trajectory import MatchingMethod, SubTrajectory, Trajectory
from api.utils.lcs import lcs
from api.utils.matching_sdk import matching_sdk
from api.utils.os_helper import *
from api.utils.request_handler import *
from app import db
from flasgger import swag_from

from . import bp


@bp.route('/matching', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'map matching',
        }
    }
})
def map_matching():
    """
    Map matching
    """
    if request.method == 'POST':
        # get all params and formdata
        req_upload_files = request.files.getlist('files')

        # create task folder
        new_task = Task()
        db.session.add(new_task)
        db.session.commit()
        g.task = new_task
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
        
        # LCSS
        current_app.logger.debug(trajectory_list)
        for trajectory in success_trajectory_list:
            lcss_method_names: list[str] = []
            lcss_inputs: list[list[Coordinate]] = []
            lcss_dicts: list[dict] = []

            # Read Coordinates
            for matching_method in trajectory.matching_method_dict.values():
                lcss_input : list[Coordinate] = []
                try:
                    with open(matching_method.path, 'r') as f:
                        for line in f:
                            line_list = line.replace('\n', '').split(' ')
                            if len(line_list) != 2:
                                continue
                            lcss_input.append(Coordinate(line_list[0], line_list[1]))
                        f.close()
                    lcss_method_names.append(matching_method.name)
                    lcss_inputs.append(lcss_input)
                except Exception:
                    current_app.logger.error('[LCSS] Unable to read: %s' % matching_method.path)
                    continue
            
            if len(lcss_method_names) < 2:
                continue

            base_lcss_input = lcss_inputs[0]
            min_base_common_indexs: list[int] = []
            has_init_min_base_common = False
            for i in range(1, len(lcss_method_names)):
                lcss_input = lcss_inputs[i]
                _, base_common_indexs, current_common_indexs = lcs(base_lcss_input, lcss_input)
                current_app.logger.debug('[LCSS] %s-%s' % (lcss_method_names[0], lcss_method_names[i]))
                if not has_init_min_base_common:
                    min_base_common_indexs = base_common_indexs
                    lcss_dicts.append(dict(zip(base_common_indexs, base_common_indexs)))
                    has_init_min_base_common = True
                else:
                    i, j = 0, 0
                    new_min_base_common_indexs = []
                    while i < len(min_base_common_indexs) and j < len(base_common_indexs):
                        if min_base_common_indexs[i] == base_common_indexs[j]:
                            new_min_base_common_indexs.append(min_base_common_indexs[i])
                            i += 1
                            j += 1
                        elif min_base_common_indexs[i] < base_common_indexs[j]:
                            i += 1
                        else:
                            j += 1
                    min_base_common_indexs = new_min_base_common_indexs
                lcss_dicts.append(dict(zip(base_common_indexs, current_common_indexs)))
            
            if len(min_base_common_indexs) == 0:
                continue
            
            for lcss_dict in lcss_dicts:
                current_app.logger.debug('[LCSS] lcss_dicts: %s' % (lcss_dict))

            # Write Coordinates
            with open(os.path.join(output_path, 'Lcss-%s' % trajectory.name), 'w') as f:
                for i in range(len(min_base_common_indexs)):
                    f.write('%s' % (base_lcss_input[min_base_common_indexs[i]]))
                f.close()

            def is_continuous(last_base_index, base_index):
                for lcss_dict in lcss_dicts:
                    last_index = lcss_dict[last_base_index]
                    current_index = lcss_dict[base_index]
                    if last_index + 1 != current_index:
                        current_app.logger.debug('is_continuous: %s %s' % (last_index, current_index))
                        return False
                return True
                # for lcss_dict in lcss_dicts:
                #     if lcss_dict[last_base_index] + 1 == lcss_dict[base_index]:
                #         return True

            sub_traj_id = 1
            sub_traj = SubTrajectory(sub_traj_id)
            sub_traj.append(base_lcss_input[min_base_common_indexs[0]], min_base_common_indexs[0])
            for i in range(1, len(min_base_common_indexs)):
                if is_continuous(min_base_common_indexs[i - 1], min_base_common_indexs[i]):
                    sub_traj.append(base_lcss_input[min_base_common_indexs[i]], min_base_common_indexs[i])
                    continue
                else:
                    trajectory.common_trajs.append(sub_traj)
                    sub_traj_id += 1
                    sub_traj = SubTrajectory(sub_traj_id)
                    sub_traj.append(base_lcss_input[min_base_common_indexs[i]], min_base_common_indexs[i])
            if (len(sub_traj.trajectory) > 0):
                trajectory.common_trajs.append(sub_traj)
            current_app.logger.debug('[LCSS] trajectory.success_trajs: %s' % (trajectory.common_trajs))

            for i in range(len(lcss_method_names)):
                lcss_method_name = lcss_method_names[i]
                lcss_input = lcss_inputs[i]
                lcss_dict = lcss_dicts[i]
                lcss_method = trajectory.matching_method_dict[lcss_method_name]
                failed_base_index_groups = []
                current_failed_begin_index = 0
                current_failed_id = 0
                for common_sub_traj in trajectory.common_trajs:
                    success_sub_traj_begin = lcss_dict[common_sub_traj.begin_index]
                    if success_sub_traj_begin > current_failed_begin_index + 1:
                        unmatched_sub_traj = SubTrajectory(current_failed_id)
                        for i in range(current_failed_begin_index, success_sub_traj_begin + 1):
                            unmatched_sub_traj.trajectory.append(lcss_input[i])
                        unmatched_sub_traj.begin_index = current_failed_begin_index
                        unmatched_sub_traj.end_index = success_sub_traj_begin
                        lcss_method.unmatched_trajs.append(unmatched_sub_traj)
                    current_failed_begin_index = lcss_dict[common_sub_traj.end_index]
                    current_failed_id = common_sub_traj.id
                if len(lcss_input)-1 > current_failed_begin_index:
                    unmatched_sub_traj = SubTrajectory(current_failed_id)
                    for i in range(current_failed_begin_index, len(lcss_input)):
                        unmatched_sub_traj.trajectory.append(lcss_input[i])
                    unmatched_sub_traj.begin_index = current_failed_begin_index
                    unmatched_sub_traj.end_index = len(lcss_input) - 1
                    lcss_method.unmatched_trajs.append(unmatched_sub_traj)
                current_app.logger.debug('[LCSS] lcss_method: %s' % (lcss_method_name))
                current_app.logger.debug('[LCSS] lcss_method.failed_trajs: %s' % (lcss_method.unmatched_trajs))

        # Write to disk
        success_traj_dicts = [ traj.to_dict() for traj in success_trajectory_list]
        trajectory_path = get_trajectory_path(new_task.id)
        for success_traj_dict in success_traj_dicts:
            with open(os.path.join(trajectory_path, '%s.json' % success_traj_dict['name']), 'w') as f:
                json.dump(success_traj_dict, f)
                f.close()

        with open(os.path.join(current_app.config['UPLOAD_DIR'], str(new_task.id), '%s.json' % new_task.id), 'w') as f:
            json.dump({
                'id': new_task.id,
                'success': [ traj.name for traj in success_trajectory_list ],
                'failed': [ traj.name for traj in failed_trajectory_list ]
            }, f)
            f.close()

        # return trajectory
        request_detail = {
            'task_id': new_task.id,
            'matching_result': {
                'success': success_traj_dicts,
                'failed': [ traj.to_dict() for traj in failed_trajectory_list],
            },
        }
        return good_request(detail=request_detail)
