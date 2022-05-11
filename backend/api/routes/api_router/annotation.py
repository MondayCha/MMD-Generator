from flask import request, current_app
from app import db, hashids
from flasgger import swag_from
from flask_jwt_extended import jwt_required, current_user

# Model
from api.models.coordinate import Coordinate, TimestampCoordinate
from api.models.data_group import DataGroup
from api.models.annotation import Annotation
from api.models.data import Data
from api.models.method import Method

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *
from api.utils.trajectory import get_bounds
from api.utils.matching_sdk import matching_for_data

# System
import os
import json

from . import bp


@bp.route('/annotations', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'Upload annotation',
        }
    }
})
@jwt_required()
def upload_annotation():
    """
    Upload annotation
    ---
    """
    if request.method == 'POST':
        req_group_hashid = request.form.get('group_hashid')
        req_data_name = request.form.get('data_name')
        req_data_analysis = request.form.get('analysis')
        req_data_annotation = request.form.get('annotation')
        req_comment = request.form.get('comment')

        if req_group_hashid is None or req_data_name is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            group_id = hashids.decode(req_group_hashid)[0]
            current_group = DataGroup.query.get(group_id)
            current_data = Data.query.filter_by(group_id=group_id, name=req_data_name).first()
            if current_group is None or current_data is None:
                return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal group id')
            data_annotation = json.loads(req_data_annotation)
            data_analysis = json.loads(req_data_analysis)
            data_annotation_path = get_matching_path(group_id)
            input_traj_name = 'annotation-%s-%s.json' % (current_user.id, req_data_name)
            data_path = os.path.join(data_annotation_path, input_traj_name)
            with open(data_path, 'w') as f:
                json.dump({
                    'trajectory': data_annotation,
                    'analysis': data_analysis,
                }, f)
                f.close()
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.INTERNAL_SERVER_ERROR)

        same_annotation = Annotation.query.filter_by(annotator_id=current_user.id, data_id=current_data.id).first()
        if same_annotation is None:
            if req_comment is not None:
                new_annotation = Annotation(data_id=current_data.id, annotator_id=current_user.id, path=data_path, comment=req_comment)
            else:
                new_annotation = Annotation(data_id=current_data.id, annotator_id=current_user.id, path=data_path)
            db.session.add(new_annotation)
            db.session.commit()
            if current_data.status != 2:
                current_data.status = 2
                db.session.add(current_data)
                db.session.commit()
        elif req_comment is not None:
            same_annotation.comment = req_comment
            db.session.add(same_annotation)
            db.session.commit()

        # Analysis
        for method in data_analysis:
            current_app.logger.info(len(method))
            if len(method) == 2:
                method_name = method[0]
                method_result = method[1]
                current_app.logger.info(method_name)
                query_method = Method.query.filter_by(name=method_name).first()
                if query_method is not None:
                    current_app.logger.info(method_result)
                    query_method.mismatched_area_count = query_method.mismatched_area_count + method_result['mismatched_area_count']
                    query_method.mismatched_point_count = query_method.mismatched_point_count + method_result['mismatched_point_count']
                    query_method.total_point_count = query_method.total_point_count + method_result['total_point_count']
                    db.session.add(query_method)
                    db.session.commit()

        # Write Coordinates
        return good_request()
    return bad_request()