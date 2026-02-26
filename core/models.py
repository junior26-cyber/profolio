from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    referral_code = models.CharField(max_length=8, unique=True)
    referred_by = models.CharField(max_length=8, blank=True, default="")


class Resume(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resumes")
    template = models.JSONField(default=dict)
    input_data = models.JSONField(default=dict)
    optional_data = models.JSONField(default=dict)
    generated_data = models.JSONField(default=dict)
    portfolio_data = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Letter(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="letters")
    linked_cv = models.ForeignKey(Resume, null=True, blank=True, on_delete=models.SET_NULL, related_name="letters")
    title = models.CharField(max_length=180, default="")
    company = models.CharField(max_length=120, blank=True, default="")
    position = models.CharField(max_length=120, blank=True, default="")
    content = models.TextField(blank=True, default="")
    template = models.CharField(max_length=40, default="elite")
    tone = models.CharField(max_length=20, default="formel")
    recruiter = models.CharField(max_length=120, blank=True, default="")
    is_draft = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
