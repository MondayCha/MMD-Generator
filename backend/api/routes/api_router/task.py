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
from app import db, hashids
from flasgger import swag_from
from flask_jwt_extended import jwt_required

from . import bp


@bp.route('/tasks', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'get tasks',
        }
    }
})
@jwt_required()
def get_tasks():
    """
    Get tasks for unannotated data.
    ---
    tags:
      - api
    """
    if request.method == 'GET':
        query_type = request.args.get('type') or 1
        query_size = request.args.get('size')
        try:
            if query_type:
                unmatched_datas = Data.query.filter_by(status=query_type).limit(query_size).all()
            else:
                unmatched_datas = Data.query.filter_by(status=query_type).all()
            if unmatched_datas:
                return good_request([{'hashid': data.group.hashid, 'name': data.name} for data in unmatched_datas])
            else:
                return good_request(detail=[])
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')
    return bad_request()