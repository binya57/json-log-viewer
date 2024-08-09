import type { BunFile, Server, ServerWebSocket } from 'bun';
import { renderToStaticMarkup } from 'react-dom/server';
import './components/Form.tsx';
import Form from './components/Form.tsx';
import Table, { buildRows, type NestedRow } from './components/Table.tsx';
/*================== */
/* You can import these file types in bun as a string */
//@ts-ignore
import htmlLayoutFileText from "./static/index.html" with { type: "text" };
//@ts-ignore
import generalCssFileText from "./static/index.css" with { type: "text" };
/*================== */
import { watch, type WatchEventType } from "fs";

type AppSocket = ServerWebSocket<{ [FILE_NAME_KEY]: string, [FILE_SIZE_KEY]: number }>

export const FILE_NAME_KEY = 'file_name';
const FILE_SIZE_KEY = 'file_size';
const decoder = new TextDecoder();


const server = Bun.serve({
    async fetch(req, server) {
        try {
            return await handleHttpRequest(req, server);
        } catch (error) {
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
        }
    },
    websocket: {
        async message(ws, message) {
        },
        // a socket is opened
        open(ws: AppSocket) {
            const path = ws.data[FILE_NAME_KEY];
            const watcher = watch(path, handleFileChange);
            process.on("SIGINT", handleCloseProcessRequest);

            async function handleFileChange(event: WatchEventType) {
                if (event !== 'change')
                    return;

                const file = Bun.file(path);
                const previousSize = ws.data[FILE_SIZE_KEY] || 0;
                const currentSize = file.size;
                const newData = await getFileAsJsonObjectsArray(file, previousSize);
                ws.data[FILE_SIZE_KEY] = currentSize;
                const html = renderToStaticMarkup(buildRows(newData));
                ws.send(html)
            }

            function handleCloseProcessRequest() {
                // close watcher when Ctrl-C is pressed
                console.log("Closing watcher...");
                watcher.close();
                ws.close(1000, "Server was treminated by user");
                process.exit(0);
            }
        },
        // a socket is closed
        close(ws, code, message) { },
        // the socket is ready to receive more data
        drain(ws) { },
    },
});

async function handleHttpRequest(req: Request, server: Server) {
    const cookies = parseCookies(req.headers.get('Cookie') || '');
    const success = server.upgrade(req, {
        data: {
            [FILE_NAME_KEY]: cookies.get(FILE_NAME_KEY),
            [FILE_SIZE_KEY]: cookies.get(FILE_SIZE_KEY),
        }
    });
    if (success) {
        // Bun automatically returns a 101 Switching Protocols
        // if the upgrade succeeds
        return undefined;
    }

    // handle HTTP request normally
    if (req.method === 'POST') {
        const formData = await req.formData();
        const fileOrFolderPath = formData.get(FILE_NAME_KEY);
        if (!fileOrFolderPath) {
            throw new Error('no file or folder path provided');
        }
        const file = Bun.file(fileOrFolderPath.toString());
        const jsonObjects = await getFileAsJsonObjectsArray(file);
        const html = renderJsxToHtml(<Table rows={jsonObjects} />);
        const page = layout(html, await Bun.file('./static/client-ws.js').text());
        const headers = new Headers({
            "Content-Type": "text/html",
            "Set-Cookie": createCookie(FILE_NAME_KEY, fileOrFolderPath.toString()),
        });
        headers.append("Set-Cookie", createCookie(FILE_SIZE_KEY, file.size.toString()));
        return new Response(page, { headers, });
    }
    const html = renderJsxToHtml(<Form />);
    const page = layout(html);
    return new Response(page, { headers: { "Content-Type": "text/html" } });
}

async function getFileAsJsonObjectsArray(file: BunFile, lastPosition = 0) {
    if (!file) {
        throw new Error("invalid file");
    }

    if (lastPosition >= file.size) {
        return [];
    }

    const stream = file.stream();
    let remainingData = "";
    const jsonObjects: NestedRow[] = [];
    let bytesRead = 0;

    // ReadableStream<Uint8Array> does have [Symbol.asyncIterator]()
    //@ts-ignore
    for await (const chunk of stream) {
        if (bytesRead + chunk.length <= lastPosition) {
            bytesRead += chunk.length;
            continue;  // Skip this chunk if it's before lastPosition
        }

        let relevantChunk;
        if (bytesRead < lastPosition) {
            // If part of the chunk is before lastPosition, slice it
            relevantChunk = chunk.slice(lastPosition - bytesRead);
            bytesRead = lastPosition;
        } else {
            relevantChunk = chunk;
        }

        const str = decoder.decode(relevantChunk);
        remainingData += str;

        let lines = remainingData.split(/\r?\n/);

        while (lines.length > 1) {
            const line = lines.shift()?.trim();
            if (line) {
                try {
                    jsonObjects.push(JSON.parse(line));
                } catch (error) {
                    console.error("Error parsing JSON:", error);
                }
            }
        }

        remainingData = lines[0] || "";
        bytesRead += relevantChunk.length;
    }

    // Handle any remaining data
    if (remainingData.trim()) {
        try {
            jsonObjects.push(JSON.parse(remainingData));
        } catch (error) {
            console.error("Error parsing JSON:", error);
        }
    }

    return jsonObjects;
}

function layout(html = '', js = '') {
    return (
        htmlLayoutFileText
            .replace('{css}', `<style>${generalCssFileText}</style>`)
            .replace('{html}', html)
            .replace('{js}', `<script>${js}</script>`)
    );
}

const renderJsxToHtml = (jsx: JSX.Element) => {
    return renderToStaticMarkup(jsx);
}

function parseCookies(cookie: string): { cookies: Record<string, string>, get: (key: string) => string } {
    return {
        cookies: Object.fromEntries(
            cookie.split(';').map(cookie => cookie.split('=').map(str => str.trim()))
        ),
        get(key: string) {
            return this.cookies[key] || '';
        }
    }
}

function createCookie(key: string, value: string) {
    return `${key}=${value}; Secure; HttpOnly; SameSite=Strict;`
}

console.log(`Listening on http://${server.hostname}:${server.port}`);
