from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wave_api", "0005_remediationmaterial_analytics"),
    ]

    operations = [
        migrations.AddField(
            model_name="quizattempt",
            name="attempts",
            field=models.IntegerField(default=0),
        ),
    ]
