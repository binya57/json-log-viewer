import './components/Form.tsx';
import { renderToStaticMarkup } from 'react-dom/server';
import Table, { buildRows, type NestedRow } from './components/Table.tsx';
import Form from './components/Form.tsx';
import type { BunFile, Server, ServerWebSocket } from 'bun';
/*================== */
/* You can import these file types in bun as a string */
//@ts-ignore
import htmlLayoutFileText from "./index.html" with { type: "text" };
//@ts-ignore
import generalCssFileText from "./index.css" with { type: "text" };
/*================== */

import { watch } from "fs";

type AppSocket = ServerWebSocket<{ file_or_folder: string, file_size: number }>

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
        // this is called when a message is received
        async message(ws, message) {
            console.log(`Received ${message}`);
            // send back a message
            ws.send(`You said: ${message}`);
        },
        // a socket is opened
        open(ws: AppSocket) {
            const path = ws.data.file_or_folder;
            const watcher = watch(path, async (event, filename) => {
                if (event !== 'change')
                    return;

                const file = Bun.file(path);
                const previousSize = ws.data.file_size || 0;
                const currentSize = file.size;
                console.log({ previousSize, currentSize });
                const newData = await getFileAsJsonObjectsArray(file, previousSize);
                ws.data.file_size = currentSize;
                const html = renderToStaticMarkup(buildRows(newData));
                ws.send(html)
            });

            process.on("SIGINT", () => {
                // close watcher when Ctrl-C is pressed
                console.log("Closing watcher...");
                watcher.close();
                ws.close(1000, "Server was treminated by user");
                process.exit(0);
            });
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
            file_or_folder: cookies.get('file_or_folder'),
            file_size: cookies.get('file_size'),
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
        const fileOrFolderPath = formData.get('file_or_folder');
        if (!fileOrFolderPath) throw new Error('no file or folder path provided');
        const file = Bun.file(fileOrFolderPath.toString());
        const jsonObjects = await getFileAsJsonObjectsArray(file);
        const html = renderJsxToHtml(<Table rows={jsonObjects} />);
        const page = layout(html, await Bun.file('client-ws.js').text());
        const headers = new Headers({
            "Content-Type": "text/html",
            "Set-Cookie": cookie('file_or_folder', fileOrFolderPath.toString()),
        });
        headers.append("Set-Cookie", cookie('file_size', file.size.toString()));
        return new Response(page, { headers, });
    }
    const html = renderJsxToHtml(<Form />);
    const page = layout(html);
    return new Response(page, { headers: { "Content-Type": "text/html" } });
}

const decoder = new TextDecoder();
async function getFileAsJsonObjectsArray(file: BunFile, lastPosition = 0) {
    if (!file) {
        throw new Error("invalid file");
    }

    console.log('received lastPosition:', lastPosition);
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




function layout(html = '', js: string = '') {
    const withLayout = htmlLayoutFileText.replace('{css}', `<style>${generalCssFileText}</style>`).replace('{html}', html).replace('{js}', `<script>${js}</script>`);
    return (
        withLayout
    )
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
            return this.cookies[key];
        }
    }
}

function cookie(key: string, value: string) {
    return `${key}=${value}; Secure; HttpOnly; SameSite=Strict;`
}

console.log(`Listening on http://${server.hostname}:${server.port}`);
