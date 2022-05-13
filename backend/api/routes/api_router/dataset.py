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


@bp.route('/datasets', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'get datasets',
        }
    }
})
@jwt_required()
def get_datasets():
    """
    Get datasets.
    ---
    tags:
      - dataset
    """
    if request.method == 'GET':
        try:
            detail = []
            datasets = DataGroup.query.all()
            for dataset in datasets:
                datas = dataset.datas
                failed_size = datas.filter_by(status=0).count()
                processed_size = datas.filter_by(status=1).count()
                annotated_size = datas.filter_by(status=2).count()
                checked_size = datas.filter_by(status=3).count()
                info = {
                    'hashid': dataset.hashid,
                    'name': dataset.name or '未命名数据集',
                    'size': {
                        'failed': failed_size,
                        'processed': processed_size,
                        'annotated': annotated_size,
                        'checked': checked_size,
                        'total': datas.count()
                    },
                }
                detail.append(info)
            return good_request(detail)
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'dataset fetch error')
    return bad_request()