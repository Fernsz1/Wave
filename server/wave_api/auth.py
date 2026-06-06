"""
Minimal token auth (demo profile).

A self-contained token model not tied to django.contrib.auth.User: a login
validates LRN+PIN (student) or TeacherID+name (teacher), mints an ApiToken, and
endpoints authenticate via `Authorization: Token <key>`.
"""
from rest_framework import authentication, exceptions

from .models import ApiToken


class Principal:
    """Lightweight authenticated user stand-in (DRF only checks is_authenticated)."""

    is_authenticated = True

    def __init__(self, token: ApiToken):
        self.role = token.role
        self.principal_id = token.principal_id


class ApiTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Token"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].decode().lower() != self.keyword.lower():
            return None
        if len(header) != 2:
            raise exceptions.AuthenticationFailed("Invalid token header.")
        try:
            token = ApiToken.objects.get(key=header[1].decode())
        except ApiToken.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid token.")
        return (Principal(token), token)
