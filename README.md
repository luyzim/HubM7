# HubM7

HubM7 is a centralized web application designed to simplify and automate the generation of configuration scripts for network devices. It provides a user-friendly interface for inputting network parameters and generates downloadable configuration files for various vendors and scenarios.

The project is built on a Node.js and Express backend, which serves a static frontend and orchestrates a series of powerful Python automation scripts.

## Core Technologies

- **Backend:** Node.js, Express.js
- **Frontend:** HTML, CSS, JavaScript (served statically)
- **Automation:** Python
- **Database:** PostgreSQL with Prisma ORM
- **Logging:** Morgan

## Project Structure

The project is organized as a monorepo containing the main Hub application and several sub-projects.

-   `server.js`: The main entry point for the Express web server.
-   `public/`: Contains the static HTML, CSS, and JavaScript files for the frontend user interface.
-   `routes/`: Defines the API endpoints for the different functionalities of the application.
-   `scripts/`: Contains the core Python automation scripts responsible for generating the device configurations.
-   `data/`: Stores template files and other data used by the automation scripts.
-   `prisma/`: Contains the Prisma schema and migration files for the database.
-   `HotsCCS/`: A sub-project for a specific service.
-   `scripts/4g/4G-2.0/`: A sub-project related to 4G services.

## Features

The HubM7 application provides several modules for different automation tasks:

-   **Cisco CCS Internet:** Generates configuration for Cisco devices.
-   **MikroTik CCS Internet:** Generates configuration for MikroTik devices.
-   **Unimed:** A specific module for Unimed-related automation.
-   **FIC:** A specific module for FIC-related automation.
-   **Backup MKT:** A module for performing backups on MikroTik devices.

The application works by taking user input from the web interface, passing it to the backend, which then calls the appropriate Python script. The Python script uses a template engine to generate the final configuration, which is then sent back to the user.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/luyzim/HubM7.git
    cd HubM7
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the database:**
    -   Make sure you have a PostgreSQL server running.
    -   Create a `.env` file in the root directory with the database connection string:
        ```
        DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
        ```
    -   Run the Prisma migrations:
        ```bash
        npx prisma migrate dev
        ```

4.  **Install Python dependencies:**
    -   It is recommended to use a virtual environment.
    -   The project does not have a `requirements.txt` file, so the dependencies need to be installed manually. Based on the scripts, you will need:
        -   `ipaddress` (standard library)
        -   (Other dependencies might be required by the sub-projects)

5.  **Run the application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3210`.

## API Endpoints

The application exposes several API endpoints under the `/api` prefix:

-   `/api/about`: Information about the application.
-   `/api/unimed`: Unimed-related tasks.
-   `/api/bkpMkt`: MikroTik backup tasks.
-   `/api/4g`: FIC-related tasks.
-   `/api/template`: Template-related tasks.
-   `/api/mkt`: MikroTik CCS internet configuration.
-   `/api/cisco`: Cisco CCS internet configuration.
-   `/api/status`: Status checking tasks.
