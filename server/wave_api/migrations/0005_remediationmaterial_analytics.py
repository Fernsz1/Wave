from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wave_api", "0004_teacher_password"),
    ]

    operations = [
        migrations.AddField(
            model_name="remediationmaterial",
            name="analytics",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
