from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Resume",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("template", models.JSONField(default=dict)),
                ("input_data", models.JSONField(default=dict)),
                ("optional_data", models.JSONField(default=dict)),
                ("generated_data", models.JSONField(default=dict)),
                ("portfolio_data", models.JSONField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="resumes", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("referral_code", models.CharField(max_length=8, unique=True)),
                ("referred_by", models.CharField(blank=True, default="", max_length=8)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Letter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(default="", max_length=180)),
                ("company", models.CharField(blank=True, default="", max_length=120)),
                ("position", models.CharField(blank=True, default="", max_length=120)),
                ("content", models.TextField(blank=True, default="")),
                ("template", models.CharField(default="elite", max_length=40)),
                ("tone", models.CharField(default="formel", max_length=20)),
                ("recruiter", models.CharField(blank=True, default="", max_length=120)),
                ("is_draft", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("linked_cv", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="letters", to="core.resume")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="letters", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
