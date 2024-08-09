
type RowValues = string | null | string | number
type Row = Record<string, RowValues>

export type NestedRow = Record<string, RowValues | Row>

type TableProps = {
    rows: NestedRow[]
}

function getHeaders(row: NestedRow) {
    return Object.keys(row)
}

function buildRows(rows: NestedRow[]) {
    const headers = getHeaders(rows[0]);
    return (
        rows.map((row, i) => (
            <tr key={i}>
                {
                    headers.map((header, j) => {
                        const value = row[header];
                        return (
                            <td key={j}>{getContent(header, value)}</td>
                        )
                    })
                }
            </tr>
        ))
    )
}

function getContent(key: string, value: NestedRow[string]) {
    if (value === null)
        return '';

    if (typeof value !== 'object')
        return value;

    return getAsList(key, value);
}

function getAsList(key: string, obj: Row) {
    return (
        <details>
            <summary>{key}</summary>
            <ul>
                {
                    Object.keys(obj).map((prop, index) => {
                        return (
                            <li key={index}>
                                <span style={{ fontWeight: 'bold' }}>{key}.{prop}</span>
                                <>{getContent(prop, obj[prop])}</>
                            </li>
                        )
                    })
                }
            </ul>
        </details>
    )
}


export default function Table({ rows }: TableProps) {
    const headers = getHeaders(rows[0]);


    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            position: 'relative',
            whiteSpace: 'pre'
        }}
        >
            <table>
                <thead>
                    {
                        headers.map((header, index) => (
                            <th key={index}>{header}</th>
                        ))
                    }
                </thead>
                <tbody>
                    {buildRows(rows)}
                </tbody>
            </table>
        </div>
    )
}