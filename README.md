# 🍽️ gnam - eat your HTTP requests

gnam is a HTTP ingester, it quite literally eats your HTTP requests and saves them so you can analyze them more easily.

## Features

- Accepts any HTTP method (GET, POST, PUT, PATCH, DELETE, etc.)
- Ingests and stores requests into a database (SQLite)
- Web UI to browse saved requests
- Runs as a single self-contained Go binary
- No CGO dependencies (runs anywhere)

## Installation

There are multiple ways to install gnam:

### Docker

You can run gnam using the pre-built Docker image from GitHub Container Registry.

**Using `docker-compose` (Recommended):**

Create a `docker-compose.yml` file with the following content:

```yaml
services:
  gnam:
    image: ghcr.io/xerosic/gnam:latest
    container_name: gnam
    ports:
      - "8080:8080"
    volumes:
      - gnam_data:/data
    restart: unless-stopped

volumes:
  gnam_data:
```

Then, start the service with:
```bash
docker-compose up -d
```

**Using `docker run`:**

```bash
docker run -d -p 8080:8080 --name gnam -v gnam_data:/data ghcr.io/xerosic/gnam:latest
```

This will run gnam and persist the database in a named volume called `gnam_data`.

### GitHub Releases

You can download pre-compiled binaries for various operating systems and architectures from the [GitHub Releases page](https://github.com/xerosic/gnam/releases).

### Using `go install`

If you have a Go environment set up, you can install `gnam` directly:
```bash
go install github.com/xerosic/gnam@latest
```
This will download, compile, and install the binary in your `$GOPATH/bin` directory.

### Build from Source

To build from source, you'll need Go installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/xerosic/gnam.git
    cd gnam
    ```

2.  **Build the binary:**
    ```bash
    go build -o gnam .
    ```

3.  **Run the application:**
    ```bash
    ./gnam
    ```

