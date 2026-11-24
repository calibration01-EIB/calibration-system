/* New file uploads go to Drive; reads continue to include legacy Supabase objects during cutover. */
(function installCalibrationStorage(global) {
  'use strict';

  const functionUrl = () => `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/google-drive-storage`;
  global.CAL_STORAGE_BACKENDS = global.CAL_STORAGE_BACKENDS || {
    certificates: 'drive',
    'repair-docs': 'drive',
    'standard-weight-certs': 'drive',
    'calibration-work-batches': 'drive',
  };
  const backends = global.CAL_STORAGE_BACKENDS;

  function makeError(payload, status) {
    const source = payload && payload.error;
    const error = new Error(source && source.message ? source.message : 'File operation failed');
    error.statusCode = Number(source && source.statusCode) || status || 500;
    error.status = error.statusCode;
    return error;
  }

  async function driveRequest(action, bucket, path, options = {}) {
    const url = new URL(functionUrl());
    const method = options.method || (action === 'list' || action === 'createSignedUrl' ? 'GET' : 'POST');
    if (method === 'GET') {
      url.searchParams.set('action', action);
      url.searchParams.set('bucket', bucket);
      url.searchParams.set('path', path || '');
      if (options.list) {
        if (options.list.limit != null) url.searchParams.set('limit', String(options.list.limit));
        if (options.list.offset != null) url.searchParams.set('offset', String(options.list.offset));
        if (options.list.search) url.searchParams.set('search', String(options.list.search));
      }
    }
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'x-app-token': calSessionToken(),
      'x-cal-storage-action': action,
      'x-cal-storage-bucket': bucket,
      'x-cal-storage-path': path || '',
    };
    if (options.upsert != null) headers['x-cal-storage-upsert'] = String(!!options.upsert);
    if (options.expiresIn != null) headers['x-cal-storage-expires'] = String(options.expiresIn);
    let body;
    if (action === 'upload') {
      headers['Content-Type'] = options.contentType || options.file?.type || 'application/octet-stream';
      body = options.file;
    } else if (action === 'remove') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ paths: options.paths || [] });
    }
    const response = await fetch(url.href, { method, headers, body });
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload && payload.error)) {
      return { data: null, error: makeError(payload, response.status) };
    }
    return payload || { data: null, error: null };
  }

  function from(bucket) {
    return {
      upload(path, file, options = {}) {
        if (backends[bucket] !== 'drive') return this._supabase.upload(path, file, options);
        const uploadToDrive = () => driveRequest('upload', bucket, path, {
          file,
          upsert: options.upsert,
          contentType: options.contentType,
        });
        if (bucket !== 'calibration-work-batches') return uploadToDrive();
        return (async () => {
          const source = await this._supabase.upload(path, file, options);
          if (source && source.error) return source;
          const drive = await uploadToDrive();
          if (drive && drive.error) {
            if (!options.upsert) await this._supabase.remove([path]).catch(() => {});
            return drive;
          }
          return drive;
        })();
      },
      list(path = '', options = {}) {
        if (backends[bucket] !== 'drive') return this._supabase.list(path, options);
        return (async () => {
          const offset = Math.max(0, Number(options.offset) || 0);
          const limit = Math.min(1000, Math.max(1, Number(options.limit) || 100));
          const pageOptions = { ...options, limit: 1000, offset: 0 };
          const [driveResult, legacyResult] = await Promise.all([
            driveRequest('list', bucket, path, { list: pageOptions }),
            this._supabase.list(path, pageOptions),
          ]);
          if (driveResult.error && ![502, 503].includes(driveResult.error.statusCode)) return driveResult;
          if (legacyResult.error && driveResult.error) return driveResult;
          const merged = new Map();
          for (const item of legacyResult.data || []) merged.set(String(item.name), item);
          for (const item of driveResult.data || []) merged.set(String(item.name), item);
          const data = [...merged.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
          if (driveResult.error) return { ...legacyResult, data: data.slice(offset, offset + limit) };
          return { ...driveResult, data: data.slice(offset, offset + limit) };
        })();
      },
      remove(paths) {
        if (backends[bucket] !== 'drive') return this._supabase.remove(paths);
        return (async () => {
          const removed = [];
          for (const path of paths || []) {
            const driveResult = await driveRequest('remove', bucket, '', { paths: [path] });
            if (driveResult.error) return driveResult;
            if ((driveResult.data || []).length) {
              removed.push(...driveResult.data);
              continue;
            }
            const legacyResult = await this._supabase.remove([path]);
            if (legacyResult.error) return legacyResult;
            removed.push(...(legacyResult.data || []));
          }
          return { data: removed, error: null };
        })();
      },
      createSignedUrl(path, expiresIn = 60, options = {}) {
        if (backends[bucket] !== 'drive') return this._supabase.createSignedUrl(path, expiresIn, options);
        return driveRequest('createSignedUrl', bucket, path, { expiresIn }).then((result) => {
          if (!result.error || ![404, 502, 503].includes(result.error.statusCode)) return result;
          return this._supabase.createSignedUrl(path, expiresIn, options);
        });
      },
      _supabase: null,
    };
  }

  function install(client) {
    if (!client || !client.storage || client.storage.__calStorageAdapter) return client;
    const nativeStorage = client.storage;
    const proxy = {
      from(bucket) {
        const wrapped = from(bucket);
        wrapped._supabase = nativeStorage.from(bucket);
        return wrapped;
      },
      __calStorageAdapter: true,
    };
    client.storage = proxy;
    return client;
  }

  global.CAL_STORAGE_BACKENDS = backends;
  global.calInstallStorageAdapter = install;
  global.calStorage = { from };
})(window);

