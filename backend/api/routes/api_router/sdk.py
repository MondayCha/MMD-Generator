'''
Author: MondayCha
Date: 2022-04-30 22:53:59
Description: Get Map-Matching SDK Result
'''
from flask import request, current_app
from app import db
from flasgger import swag_from

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *

# System
import os
import json

from . import bp


@bp.route('/sdk/results', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'tarj info',
        }
    }
})
def get_sdk_matching_results():
    """
    Get tarj info
    ---
    parameters:
      - in: query
        name: task_id (hashids)
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

        try:
            req_task_id = current_app.hashids.decode(req_task_id)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')

        json_file_path = os.path.join(get_matching_path(req_task_id), '%s.json' % req_tarj_name)
        if not os.path.exists(json_file_path):
            return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'tarj not found')
        
        traj_detail = json.load(open(json_file_path, 'r'))
        current_app.logger.debug('[api/trajs]: %s' % traj_detail['traj_name'])

        return good_request(traj_detail)
    return bad_request()
