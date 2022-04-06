# Map-Matching Dataset Generator

## 1. Quick Start

### 1.1 Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip3 install --upgrade pip
pip install -r requirements.txt
```

### 1.2 Requirements

```bash
pip install pipreqs
pipreqs . --encoding=utf8 --force --mode no-pin --savepath requirements-pipreqs.txt
```

### 1.3 Migrations
```
flask db init
flask db migrate -m "xxx"
flask db upgrade
```
### 1.4 Run app
```
flask run -h 0.0.0.0 -p 80
```