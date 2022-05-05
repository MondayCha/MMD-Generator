'''
Author: MondayCha
Date: 2022-04-09 21:38:24
Description: api/tasks
'''
from flask import request, g, current_app
from app import db, jwt
from flasgger import swag_from
from flask_jwt_extended import (
    create_access_token,
    unset_access_cookies,
    current_user,
    jwt_required,
    get_jwt,
    get_jwt_identity
)

# Utils
from api.utils.os_helper import *
from api.utils.request_handler import *

# Models
from api.models.authorize import User

# System
from datetime import datetime, timedelta, timezone
import json

from ..api_router import bp


@jwt.invalid_token_loader
def my_invalid_token_callback(error):
    return bad_request(RETStatus.JWT_INVALID, HTTPStatus.UNAUTHORIZED, error)


@jwt.expired_token_loader
def my_expired_token_callback(error):
    return bad_request(RETStatus.JWT_INVALID, HTTPStatus.UNAUTHORIZED, error)


@jwt.unauthorized_loader
def my_unauthorized_loader_callback(error):
    return bad_request(RETStatus.JWT_INVALID, HTTPStatus.UNAUTHORIZED, error)



@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.query.filter_by(id=identity).one_or_none()


@bp.after_request
def refresh_expiring_jwts(response):
    try:
        exp_timestamp = get_jwt()["exp"]
        now = datetime.now(timezone.utc)
        target_timestamp = datetime.timestamp(now + timedelta(minutes=60))
        if target_timestamp > exp_timestamp:
            access_token = create_access_token(identity=get_jwt_identity())
            data = response.get_json()
            if type(data) is dict:
                data["access_token"] = access_token
                response.data = json.dumps(data)
        return response
    except (RuntimeError, KeyError):
        # Case where there is not a valid JWT. Just return the original respone
        return response


@bp.route('/register', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'register',
        }
    }
})
def register():
    """
    Register
    ---
    """
    if request.method == 'POST':
        username = request.json.get("username", None)
        password = request.json.get("password", None)
        if username is None or password is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')
        user = User.query.filter_by(username=username).first()
        if user is not None:
            return bad_request(RETStatus.AUTH_ERR, HTTPStatus.NOT_FOUND, 'user already exist')
        user = User(username=username, password=password, usertype=1)
        db.session.add(user)
        db.session.commit()
        return good_request('register success')



@bp.route('/login', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'login',
        }
    }
})
def login():
    """
    Login
    ---
    """
    username = request.json.get("username", None)
    password = request.json.get("password", None)

    user = User.query.filter_by(username=username).one_or_none()
    if not user or not user.password == password:
        return bad_request(status_code=HTTPStatus.OK, ret_status_code=RETStatus.AUTH_ERR)

    access_token = create_access_token(identity=user.id)
    response = jsonify({
        'status_code': RETStatus.SUCCESS,
        'detail': "login successful",
        "access_token" : access_token
    })
    response.status_code = HTTPStatus.OK
    return response


@bp.route('/logout', methods=['POST'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'logout',
        }
    }
})
def lologoutgin():
    """
    Logout
    ---
    """
    response = jsonify({
            'status_code': RETStatus.SUCCESS,
            'detail': "logout successful",
            "access_token" : "",
        })
    unset_access_cookies(response)
    return response


@bp.route("/user", methods=["GET"])
@jwt_required()
def protected():
    # We can now access our sqlalchemy User object via `current_user`.
    return good_request(detail={
        "username": current_user.username,
        "usertype": current_user.usertype,
        "id": current_user.id,
        "password": current_user.password
        })