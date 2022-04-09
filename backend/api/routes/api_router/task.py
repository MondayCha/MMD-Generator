from flask import request, g, current_app
from app import db
from flasgger import swag_from

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
        
        json_file_path = os.path.join(get_task_path(req_task_id), '%s.json' % req_task_id)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'tarj not found')
        
        task_detail = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/tasks]: %s' % req_task_id)

        return good_request(task_detail)
    return bad_request()