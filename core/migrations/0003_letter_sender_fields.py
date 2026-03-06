from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_userprofile_is_approved"),
    ]

    operations = [
        migrations.AddField(
            model_name="letter",
            name="sender_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="letter",
            name="sender_name",
            field=models.CharField(blank=True, default="", max_length=180),
        ),
        migrations.AddField(
            model_name="letter",
            name="sender_phone",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
    ]
