# PostgreSQL Database Setup (Windows)

This guide outlines how to migrate the Wave server from the default SQLite database to a local, bare-metal PostgreSQL instance on Windows (without using Docker).

> **Note:** This guide was tested using **PostgreSQL 18.4**.

## 1. Install PostgreSQL on Windows
1. Download the PostgreSQL 18.4 interactive installer from the [EnterpriseDB Windows download page](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Run the installer and keep the default settings (it installs the PostgreSQL Server, pgAdmin 4, Stack Builder, and Command Line Tools).
3. **Important:** During installation, you will be prompted to enter a password for the default database superuser (`postgres`). Remember this password, as you will need it later. Keep the default port as `5432`.

## 2. Create the Database and User
You can set up the required database and user using **pgAdmin 4**, which comes bundled with the PostgreSQL installation.

1. Open **pgAdmin 4** from your Windows Start menu.
2. Connect to the local server by entering the password you set during installation.
3. **Create User:**
   - Right-click on **Login/Group Roles** > **Create** > **Login/Group Role**.
   - **General Tab:** Name it `wave_user`
   - **Definition Tab:** Set a password (e.g., `wave_password`)
   - **Privileges Tab:** Toggle "Can login?" to **Yes**.
   - Click **Save**.
4. **Create Database:**
   - Right-click on **Databases** > **Create** > **Database**.
   - **General Tab:** Name it `wave_db` and select `wave_user` as the Owner.
   - Click **Save**.

## 3. Install the Python Postgres Driver
Your Django app needs the `psycopg2` driver to communicate with PostgreSQL. Open your terminal, navigate to the `server` directory, activate your virtual environment, and install it:

```powershell
cd server
.venv\Scripts\activate
pip install psycopg2-binary
```

*(Optional: Add `psycopg2-binary` to your `requirements.txt` file so other developers installing the project will get it automatically.)*

## 4. Update Django Settings
Update your database configuration in `config/settings.py`. Replace the default SQLite `DATABASES` block with the following:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "wave_db",            # The name of the database you created
        "USER": "wave_user",          # The user you created
        "PASSWORD": "wave_password",  # The password for that user
        "HOST": "127.0.0.1",          # Localhost
        "PORT": "5432",               # Default PostgreSQL port
    }
}
```

## 5. Run Migrations and Seed the Database
Now that Django is connected to your new blank PostgreSQL database, you need to apply the schemas and seed your initial data. Run the following commands with your virtual environment activated:

```powershell
python manage.py migrate
python manage.py seed_data
```

Once this is complete, start your Django server normally:
```powershell
python manage.py runserver 0.0.0.0:8000
```
It is now fully backed by your native PostgreSQL 18.4 installation!
