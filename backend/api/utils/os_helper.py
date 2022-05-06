'''
Author: MondayCha
Date: 2022-04-06 15:44:42
Description: OS Helper Functions
'''
import shutil
import subprocess
import os
from flask import current_app


def create_data_group_folder(data_group_id):
    data_group_id = str(data_group_id)
    task_folder = get_data_group_path(data_group_id)
    if os.path.exists(task_folder):
        shutil.rmtree(task_folder)
    
    os.makedirs(get_input_path(data_group_id))
    os.makedirs(get_output_path(data_group_id))
    os.makedirs(get_matching_path(data_group_id))


def get_data_group_path(data_group_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], 'group', str(data_group_id))


def get_input_path(data_group_id):
    return os.path.join(get_data_group_path(data_group_id), 'input')


def get_output_path(data_group_id):
    return os.path.join(get_data_group_path(data_group_id), 'output')


def get_matching_path(data_group_id):
    return os.path.join(get_data_group_path(data_group_id), 'matching')


def get_user_modify_path(user_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], 'modify', str(user_id))


def create_user_modify_folder(user_id):
    user_id = str(user_id)
    modify_folder = get_user_modify_path(user_id)
    if os.path.exists(modify_folder):
        shutil.rmtree(modify_folder)

    input_path = os.path.join(get_user_modify_path(user_id), 'input')
    output_path = os.path.join(get_user_modify_path(user_id), 'output')
    matching_path = os.path.join(get_user_modify_path(user_id), 'matching')
    
    os.makedirs(input_path)
    os.makedirs(output_path)
    os.makedirs(matching_path)

    return input_path, output_path, matching_path


def cmd(command):
    result = {}
    p = subprocess.Popen(command, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    (out, err) = p.communicate()
    result['stdout'] = out.decode('utf-8')
    result['stderr'] = err.decode('utf-8')
    return p.returncode, result