# Webserver with WebSockets

This project is a web server with WebSocket support for stopwatch synchronization and split times. It includes a remote control interface and a display screen for showing split times.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Docker Setup](#docker-setup)
- [Using GitHub Packages](#using-github-packages)
- [Project Structure](#project-structure)
- [License](#license)

## Overview

The project consists of a Node.js server that serves HTML files and manages WebSocket connections. The WebSocket connections are used to synchronize a stopwatch and split times between a remote control interface and a display screen.

## Features

- Start and reset a stopwatch from a remote interface.
- Display split times for multiple lanes on a screen.
- Real-time synchronization of stopwatch and split times using WebSockets.

## Getting Started

### Prerequisites

- Node.js (>= 20.0.0)
- Docker (optional, for containerized setup)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/your-username/webserver-with-websockets.git
    cd webserver-with-websockets
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Start the server:
    ```sh
    npm start
    ```

4. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/1).

## Usage

- **Remote Control Interface**: Open [http://localhost:8080/remote.html](http://_vscodecontentref_/2) to access the remote control interface. Use the buttons to start/reset the stopwatch and record split times.
- **Display Screen**: Open [http://localhost:8080/screen.html](http://_vscodecontentref_/3) to view the split times for each lane.

## Docker Setup

To run the project using Docker, follow these steps:

1. Build the Docker image:
    ```sh
    docker-compose build
    ```

2. Start the services:
    ```sh
    docker-compose up
    ```

3. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/4).

## Using GitHub Packages

To use the Docker image published to GitHub Packages, follow these steps:

1. Authenticate with GitHub Packages:
    ```sh
    echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
    ```

2. Pull the Docker image:
    ```sh
    docker pull ghcr.io/your-username/webserver-with-websockets:latest
    ```

3. Run the Docker container:
    ```sh
    docker run -p 8080:8080 ghcr.io/your-username/webserver-with-websockets:latest
    ```

4. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/5).

## Project Structure
