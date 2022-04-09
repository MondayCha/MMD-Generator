from flask import request, g, current_app
from app import db
from flasgger import swag_from

# Models
from api.models.task import Task

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *

# System
import os
import json

from ..api_router import bp


@bp.route('/trajectories', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'tarj info',
        }
    }
})
def get_trajectory_info():
    """
    Get tarj info
    ---
    parameters:
      - in: query
        name: task_id
        required: true
        description: Task id
        schema:  
            type: integer
      - in: query
        name: traj_name
        required: true
        description: Traj Name
        schema:  
            type: string      
    """
    if request.method == 'GET':
        req_task_id = request.args.get('task_id')
        req_tarj_name = request.args.get('traj_name')

        if req_task_id is None or req_tarj_name is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')
        
        json_file_path = os.path.join(get_trajectory_path(req_task_id), '%s.json' % req_tarj_name)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'tarj not found')
        
        traj_detail = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/trajs]: %s' % traj_detail['name'])

        return good_request(traj_detail)
    return bad_request()