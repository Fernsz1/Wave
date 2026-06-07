from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wave_api", "0002_alter_quizattempt_perfect_score"),
    ]

    operations = [
        migrations.AddField(
            model_name="summativeresult",
            name="attempts",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="remediationmaterial",
            name="created_summative",
            field=models.JSONField(default=list),
        ),
    ]
