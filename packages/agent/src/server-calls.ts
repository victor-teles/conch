// Server functions that reach outside the query's own rows: the file
// system, other sessions or servers, locks and configuration. They are
// refused as calls in every form, quoted or schema-qualified.
const READ_PATH_PREFIXES = [
  "pg_read_",
  "pg_ls_",
  "pg_file_",
  "pg_stat_file",
  "pg_logdir_",
  "pg_advisory",
  "pg_try_advisory",
  "pg_backup_",
  "pg_create_",
  "pg_drop_",
  "pg_replication_",
  "pg_logical_",
  "lo_",
  "dblink",
  "query_to_xml",
  "cursor_to_xml",
  "xp_",
  "sp_",
  "sys_",
];

const READ_PATH_FUNCTIONS = [
  "pg_reload_conf",
  "pg_rotate_logfile",
  "pg_promote",
  "pg_switch_wal",
  "pg_notify",
  "pg_start_backup",
  "pg_stop_backup",
  "set_config",
  "load_file",
  "loread",
  "lowrite",
  "readfile",
  "writefile",
  "load_extension",
  "sleep",
  "benchmark",
];

const SERVER_CALL = new RegExp(
  String.raw`\b((?:${READ_PATH_PREFIXES.join("|")})\w*|${READ_PATH_FUNCTIONS.join("|")})\s*\(`,
  "i"
);

export const serverCallIn = (names: string): string | null =>
  SERVER_CALL.exec(names)?.[1]?.toLowerCase() ?? null;
