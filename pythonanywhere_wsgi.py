# PythonAnywhere の「WSGI configuration file」に、このファイルの中身をまるごと貼り付けて使う。
# YOUR_USERNAME の部分を、自分の PythonAnywhere のユーザー名に書き換えること。
import os
import sys

PROJECT = '/home/YOUR_USERNAME/netguardians'
if PROJECT not in sys.path:
    sys.path.insert(0, PROJECT)

# Web 公開版では、セーブはプレイヤーのブラウザ内だけに保存する
# （サーバーのセーブは1つしかなく、全員で上書きし合ってしまうため）
os.environ['SERVER_SAVE'] = '0'

from app import app as application  # noqa: E402
