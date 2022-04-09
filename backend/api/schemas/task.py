from api.models.task import Task
from app import ma


class TaskSchema(ma.SQLAlchemySchema):
    class Meta:
        model = Task
    
    id = ma.auto_field()


task_schema = TaskSchema()
tasks_schema = TaskSchema(many=True)
