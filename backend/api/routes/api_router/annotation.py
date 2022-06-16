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
    tags:
      - annotation
    """
    if request.method == 'POST':
        req_group_hashid = request.form.get('group_hashid')
        req_data_name = request.form.get('data_name')
        req_data_analysis = request.form.get('analysis')
        req_data_annotation = request.form.get('annotation')
        req_raw_traj = request.form.get('raw_traj')
        req_bounds = request.form.get('bounds')
        req_metric = request.form.get('metric')
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
            data_raw_traj = json.loads(req_raw_traj)
            data_bounds = json.loads(req_bounds)
            data_metric = json.loads(req_metric)
            data_annotation_path = get_matching_path(group_id)
            input_traj_name = 'annotation-%s-%s.json' % (current_user.id, req_data_name)
            data_path = os.path.join(data_annotation_path, input_traj_name)
            user_path = os.path.join(data_annotation_path, 'user-%s.txt' % current_user.id)
            with open(data_path, 'w') as f:
                json.dump({
                    'group_hashid': req_group_hashid,
                    'data_name': req_data_name,
                    'trajectory': data_annotation,
                    'raw_traj': data_raw_traj,
                    'analysis': data_analysis,
                    'bounds': data_bounds,
                    'comment': req_comment,
                    'annotator': current_user.username,
                }, f)
                f.close()
            with open(user_path, 'a') as f:
                # {"u_turns_count":0,"single_lcs_count":0,"simplified_traj_count":1,"mismatched_area_count":1,"prematched_area_count":0,"time":5536}
                csv_line = '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' % (req_data_name, data_metric['u_turns_count'], data_metric['single_lcs_count'], data_metric['simplified_traj_count'], data_metric['mismatched_area_count'], data_metric['prematched_area_count'], data_metric['time'])
                f.write(csv_line)
                f.close()
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.INTERNAL_SERVER_ERROR)

        same_annotation = Annotation.query.filter_by(annotator_id=current_user.id, data_id=current_data.id).first()
        if same_annotation is None:
            if req_comment is not None:
                new_annotation = Annotation(data_id=current_data.id, annotator_id=current_user.id, path=data_path, comment=req_comment)
            else:
                new_annotation = Annotation(data_id=current_data.id, annotator_id=current_user.id, path=data_path)
            if current_user.usertype == 0:
                new_annotation.status = 1
            db.session.add(new_annotation)
            db.session.commit()
            if current_data.status != 2:
                current_data.status = 3 if current_user.usertype == 0 else 2
                db.session.add(current_data)
                db.session.commit()
        elif req_comment is not None:
            same_annotation.comment = req_comment
            if current_user.usertype == 0:
                same_annotation.status = 1
            else:
                same_annotation.status = -1
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


@bp.route('/annotations', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'get annotations',
        }
    }
})
@jwt_required()
def get_annotations():
    """
    Get annotations
    ---
    tags:
      - annotation
    """
    if request.method == 'GET':
        query_type = request.args.get('type') or -1  # -1: unreviewd, 0: failed 1: selected
        try:
            annotations = Annotation.query.filter_by(status=query_type).all()
            if annotations:
                return good_request([annotation.to_dict() for annotation in annotations])
            return good_request(detail=[])
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')
    return bad_request()


@bp.route('/annotations/<hashid>', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'get annotation',
        }
    }
})
@jwt_required()
def get_annotation(hashid):
    """
    Get annotation
    ---
    tags:
      - annotation
    """
    if request.method == 'GET':
        if hashid is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            annotation_id = hashids.decode(hashid)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal annotation id')

        try:
            annotation = Annotation.query.filter_by(id=annotation_id).first()
            if annotation:
                json_file_path = annotation.path
                if not os.path.exists(json_file_path):
                    return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.NOT_FOUND, 'annotation for data not found')
                detail = json.load(open(json_file_path, 'r'))
                return good_request(detail)
            return good_request(detail=[])
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')
    return bad_request()


@bp.route('/annotations/<hashid>', methods=['PUT'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'modify annotation',
        }
    }
})
@jwt_required()
def modify_annotation(hashid):
    """
    Modify annotation
    ---
    tags:
      - annotation
    """
    if request.method == 'PUT':
        req_status = request.form.get('status') or -1  # -1: unreviewd, 0: failed 1: selected
        req_review_comment = request.form.get('review_comment')
        if hashid is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            annotation_id = hashids.decode(hashid)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal annotation id')

        try:
            annotation = Annotation.query.filter_by(id=annotation_id).first()
            annotation.status = req_status
            if req_review_comment is not None:
                annotation.review_comment = req_review_comment
            db.session.add(annotation)
            db.session.commit()
            if int(req_status) == 1:
                current_data = annotation.data
                current_data.status = 3
                db.session.add(current_data)
                db.session.commit()
            return good_request()
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal task id')
    return bad_request()