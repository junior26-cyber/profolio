from django.contrib import admin

from .models import Letter, Resume, UserProfile

admin.site.register(UserProfile)
admin.site.register(Resume)
admin.site.register(Letter)
