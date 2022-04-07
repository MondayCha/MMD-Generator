import subprocess


def cmd(command):
    result = {}
    p = subprocess.Popen(command, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    (out, err) = p.communicate()
    result['stdout'] = out.decode('utf-8')
    result['stderr'] = err.decode('utf-8')
    return p.returncode, result