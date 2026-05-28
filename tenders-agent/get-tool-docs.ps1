# Run from tenders-agent folder: .\get-tool-docs.ps1
$tools = @("list_tables_for_base", "list_records_for_table", "search_records", "get_table_schema")
foreach ($tool in $tools) {
    $toolDash = $tool -replace "_", "-"
    Write-Host "`n=== $tool ===" -ForegroundColor Cyan
    npx @airtable/mcp-cli $toolDash --help
}
