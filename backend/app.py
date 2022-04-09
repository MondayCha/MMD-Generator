import logging
from flask import Flask
from config import Config
from flask_cors import CORS
from flasgger import Swagger
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_marshmallow import Marshmallow

db = SQLAlchemy()
migrate = Migrate()
ma = Marshmallow()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)

    # set up instance
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    swagger = Swagger(app)
    CORS(app, supports_credentials=True)

    # routes
    from api.routes import api_router
    app.register_blueprint(api_router.bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=80)
