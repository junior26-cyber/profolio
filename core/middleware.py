from django.http import HttpResponseRedirect


class AccountActivationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_prefixes = (
            "/login/",
            "/register/",
            "/logout/",
            "/inactive-account/",
            "/admin/",
            "/static/",
        )

    def __call__(self, request):
        user = getattr(request, "user", None)
        path = request.path or "/"
        profile = getattr(user, "profile", None) if user and getattr(user, "is_authenticated", False) else None
        is_approved = bool(getattr(profile, "is_approved", True))
        if (
            user
            and user.is_authenticated
            and not is_approved
            and not user.is_staff
            and not user.is_superuser
            and not any(path.startswith(prefix) for prefix in self.allowed_prefixes)
        ):
            return HttpResponseRedirect("/inactive-account/")
        return self.get_response(request)
