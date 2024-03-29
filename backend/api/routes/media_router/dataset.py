import os
import json
import zipfile
from flask import request, send_file
from api.models.data_group import DataGroup
from api.models.annotation import Annotation
from api.utils.os_helper import *
from api.utils.request_handler import *
from app import hashids
from flasgger import swag_from
from flask_jwt_extended import jwt_required


from . import bp

@bp.route('/datasets/<hashid>/<export_type>', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'get dataset zip file',
        }
    }
})
@jwt_required()
def export_dataset(hashid, export_type):
    """
    Get dataset zip file
    ---
    tags:
      - annotation
    """
    if request.method == 'GET':

        if hashid is None:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'missing params')

        try:
            data_group_id = hashids.decode(hashid)[0]
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal dataset id')

        try:
            dataset = DataGroup.query.filter_by(id=data_group_id).first()
            checked_datas = dataset.datas.filter_by(status=3)
            total_size = dataset.datas.count()
            archive_name = '%s-%s(%s-%s).zip' % (hashid, export_type, str(checked_datas.count()), str(total_size))
            archive_path = os.path.join(get_data_group_path(data_group_id), archive_name)
            if not os.path.exists(archive_path):
                try:
                    zip_file = zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED)
                    for checked_data in checked_datas:
                        annotation = Annotation.query.filter_by(data_id=checked_data.id).first()
                        if export_type == 'json':
                            zip_file.write(annotation.path, '%s.json' % checked_data.name)
                        elif export_type == 'txt':
                            txt_file_path = os.path.join(get_output_path(dataset.id), 'MMDGMatching-%s' % checked_data.name)
                            if not os.path.exists(txt_file_path):
                                json_file_path = annotation.path
                                if not os.path.exists(json_file_path):
                                    return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND, 'illegal dataset')
                                detail = json.load(open(json_file_path, 'r'))
                                with open(txt_file_path, 'w') as f:
                                    traject_list = detail['trajectory']
                                    for traject in traject_list:
                                        f.write('%s %s\n' % (traject['longitude'], traject['latitude']))
                                    f.close()
                            zip_file.write(txt_file_path, '%s.txt' % checked_data.name)
                    zip_file.close()
                except Exception:
                    return bad_request(RETStatus.FILE_SYSTEM_ERR, HTTPStatus.INTERNAL_SERVER_ERROR)
            return send_file(archive_path, mimetype='zip', as_attachment=True, attachment_filename=archive_name)
        except Exception:
            return bad_request(RETStatus.PARAM_INVALID, HTTPStatus.NOT_FOUND)
    return bad_request()