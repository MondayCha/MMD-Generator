'''
Author: MondayCha
Date: 2022-04-09 21:38:24
Description: api/tasks
'''
from flask import request, g, current_app
from app import db
from flasgger import swag_from
from flask_jwt_extended import jwt_required

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *

# System
import os
import json

from ..api_router import bp


@bp.route('/tasks', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'tarj info',
        }
    }
})
@jwt_required()
def get_task_info():
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
    """
    if request.method == 'GET':
        req_task_id = request.args.get('task_id')

        if req_task_id is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            task_id = current_app.hashids.decode(req_task_id)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')

        json_file_path = os.path.join(get_task_path(task_id), '%s.json' % task_id)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'tarj not found')
        
        task_detail = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/tasks]: %s' % task_id)

        return good_request(task_detail)
    return bad_request()