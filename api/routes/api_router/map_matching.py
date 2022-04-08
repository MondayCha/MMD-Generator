import os
from flask import request, g, current_app
from werkzeug.utils import secure_filename
from api.models.task import Task
from api.models.trajectory import Trajectory
from api.utils.matching_sdk import matching_sdk
from api.utils.os_helper import create_task_folder, get_input_path, get_output_path
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
        trajectory_list = []
        for file in req_upload_files:
            try:
                secure_name = secure_filename(file.filename)
                file_path = os.path.join(input_path, secure_name)
                file.save(file_path)
                trajectory_list.append(Trajectory(secure_name, file_path))
            except Exception:
                current_app.logger.error('Unable to save: %s' % file.filename)
                continue

        matching_sdk_code, matching_sdk_dict = matching_sdk()
        if matching_sdk_code == 1:
            return bad_request(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,ret_status_code=RETStatus.SDK_ERR, detail=matching_sdk_dict)
        
        matching_methods = current_app.config.get('MATCHING_METHODS')
        
        success_trajectory_list = []
        fail_trajectory_list = []
        for trajectory in trajectory_list:
            success_matching_time = 0
            for matching_method in matching_methods:
                if os.path.exists(os.path.join(output_path, "%s-%s" % (matching_method, trajectory.name))):
                    success_matching_time += 1
                    trajectory.matching_methods.append(matching_method)
            if success_matching_time >= 2:
                trajectory.success = True
                success_trajectory_list.append(trajectory)
            else:
                fail_trajectory_list.append(trajectory)
        
        current_app.logger.debug(trajectory_list)
        for trajectory in success_trajectory_list:
            # Read Coordinates
            with open(trajectory.path, 'r') as f:
                for line in f:
                    if line.startswith('#'):
                        continue
                    line = line.strip()
                    if line == '':
                        continue
                    line_list = line.split(' ')
                    if len(line_list) != 2:
                        continue
                    trajectory.coordinates.append(line_list)

        return good_request(detail=matching_sdk_dict)
