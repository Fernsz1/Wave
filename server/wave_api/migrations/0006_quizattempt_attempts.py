from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wave_api", "0005_remediationmaterial_analytics"),
    ]

    # No-op: this migration and the sibling 0006_quizattempt_attempts_and_more
    # were created on two branches that BOTH added `quizattempt.attempts`. The
    # sibling is the one that actually adds the column; applying the AddField here
    # too breaks any fresh database ("column already exists"). Emptied so the
    # merge graph (0007) stays valid while the column is added exactly once.
    operations = []
