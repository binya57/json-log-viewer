import './components/Form.tsx';
import { isValidElement } from "react";
import { renderToStaticMarkup } from 'react-dom/server';
import Table, { type NestedRow } from './components/Table.tsx';
import Form from './components/Form.tsx';
import type { Server, ServerWebSocket } from 'bun';
import htmlLayoutFile from "./index.html" with { type: "text" };
import css from "./index.css" with { type: "text" };
import { watch } from "fs";

type AppSocket = ServerWebSocket<{ file_or_folder: string }>

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
            const watcher = watch(path, (event, filename) => {
                if (event !== 'change') return;
                ws.send('this file have changed')
            });

            process.on("SIGINT", () => {
                // close watcher when Ctrl-C is pressed
                console.log("Closing watcher...");
                watcher.close();

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
    const success = server.upgrade(req, {
        data: {
            file_or_folder: parseCookie(req.headers.get('Cookie'))
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
        const jsonObjects = await getFileAsJsonObjectsArray(fileOrFolderPath?.toString() ?? '');
        const html = renderJsxToHtml(<Table rows={jsonObjects} />);
        const page = layout(html);
        return new Response(page, {
            headers: {
                "Content-Type": "text/html",
                "Set-Cookie": `file_or_folder=${fileOrFolderPath}; Secure; HttpOnly; SameSite=Strict;`
            }
        });
    }
    const html = renderJsxToHtml(<Form />);
    const page = layout(html);
    return new Response(page, { headers: { "Content-Type": "text/html" } });
}

const decoder = new TextDecoder();
async function getFileAsJsonObjectsArray(path: string) {
    if (!path) {
        throw new Error("invalid path");
    }
    const file = Bun.file(path);
    const stream = file.stream();
    let remainingData = "";
    const jsonObjects: NestedRow[] = [];
    for await (const chunk of stream) {
        const str = decoder.decode(chunk);
        remainingData += str; // Append the chunk to the remaining data
        // Split the remaining data by newline character
        let lines = remainingData.split(/\r?\n/);
        // Loop through each line, except the last one
        while (lines.length > 1) {
            // Remove the first line from the array and pass it to the callback

            const line = lines.shift();
            jsonObjects.push(JSON.parse(line || "{}"));
        }
        // Update the remaining data with the last incomplete line
        remainingData = lines[0];
    }
    return jsonObjects;
}



function layout(html: string) {
    const withLayout = htmlLayoutFile.replace('{html}', html).replace('{css}', `<style>${css}</style>`);
    return (
        withLayout
    )
}

const renderJsxToHtml = (jsx: JSX.Element) => {
    return renderToStaticMarkup(jsx);
}

function parseCookie(cookie: string) {
    return cookie.split('=')[1];
}


console.log(`Listening on http://${server.hostname}:${server.port}`);
