{{- with .File -}}
  {{- os.ReadFile .Filename -}}
{{- end -}}
