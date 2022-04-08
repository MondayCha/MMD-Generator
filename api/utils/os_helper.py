import shutil
import subprocess
import os
from flask import current_app


def create_task_folder(task_id):
    task_folder = os.path.join(current_app.config['UPLOAD_DIR'], str(task_id))
    if os.path.exists(task_folder):
        shutil.rmtree(task_folder)
    os.makedirs(os.path.join(task_folder, 'input'))
    os.makedirs(os.path.join(task_folder, 'output'))


def get_input_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'input')


def get_output_path(task_id):
    return os.path.join(current_app.config['UPLOAD_DIR'], str(task_id), 'output')


def cmd(command):
    result = {}
    p = subprocess.Popen(command, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    (out, err) = p.communicate()
    result['stdout'] = out.decode('utf-8')
    result['stderr'] = err.decode('utf-8')
    return p.returncode, result