export default function Form() {
    return (
        <div className="root">
            <form method="post" action="http://localhost:3000" id="form">
                <label htmlFor="file_or_folder">Enter File or Folder</label>
                <input type="text" name="file_or_folder" id="file_or_folder" required autoComplete="on" />
                <input type="submit" value="Submit" />
            </form>
        </div>
    )
}