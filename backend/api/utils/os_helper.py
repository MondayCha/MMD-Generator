'''
Author: MondayCha
Date: 2022-04-06 15:44:42
Description: OS Helper Functions
'''
import shutil
import subprocess
import os
from flask import current_app


def create_task_folder(task_id):
    task_id = str(task_id)
    task_folder = get_task_path(task_id)
    if os.path.exists(task_folder):
        shutil.rmtree(task_folder)
    
    os.makedirs(get_input_path(task_id))
    os.makedirs(get_output_path(task_id))
    os.makedirs(get_trajectory_path(task_id))
    os.makedirs(get_matching_path(task_id))


def get_task_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id))


def get_input_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'input')


def get_output_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'output')


def get_trajectory_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'trajectory')

def get_matching_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'matching')


def cmd(command):
    result = {}
    p = subprocess.Popen(command, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    (out, err) = p.communicate()
    result['stdout'] = out.decode('utf-8')
    result['stderr'] = err.decode('utf-8')
    return p.returncode, result