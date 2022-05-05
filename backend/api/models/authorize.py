from app import db

class User(db.Model):
    __tablename__ = "user"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(300), nullable=False, unique=True)
    usertype = db.Column(db.Integer, nullable=False) # 0: admin, 1: user

    def __repr__(self):
        return '<User %r>' % self.username