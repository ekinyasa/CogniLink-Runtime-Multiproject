# CogniLink Runtime Diff Engine

The Runtime Diff Engine is a pure, side-effect free logic module (`functions/_shared/runtime-diff.js`) that safely compares legacy data records against the newly generated `RuntimeContext` from the Runtime Adapter.

## Amacı

Diff Engine'in tek amacı; eski karmaşık (legacy) pipeline ile, yeni ayrık (decoupled) mimari arasında bir veri veya davranış kayması olup olmadığını tespit etmektir. Migration (Cutover) öncesinde adapter'ın güvenli olduğunu matematiksel olarak kanıtlamamızı sağlar.

## Public Contract

Tek public fonksiyonu: `compareRuntime(legacyObject, runtimeContext)`

- Parametre olarak Repository'den dönen orijinal legacy objeyi (`hubConfig` veya `campaignData`) ve Adapter'ın ürettiği `RuntimeContext` hiyerarşisini alır.
- Geriye şu formatta standart, deterministik bir JSON döner:
```json
{
    "identical": false,
    "mismatchCount": 1,
    "items": [
        {
            "field": "pageContent.components",
            "type": "missing",
            "expected": 5,
            "actual": 4
        }
    ]
}
```

## Diff Tipleri

- **`mismatch`**: İki tarafta da alan var ancak primitive değerleri uyuşmuyor.
- **`missing`**: Beklenen (legacy) objesinde veri var, fakat yeni sistemde kaybolmuş.
- **`extra`**: Eski sistemde yok, fakat yeni sistem (örn. defaults veya adapter) bir veri eklemiş.
- **`type_mismatch`**: Veriler var fakat JS tipleri eşleşmiyor (String vs Number).

## Deterministic Guarantee

Diff Engine, Adapter gibi pure function olarak tasarlanmıştır. Dış dünyaya hiçbir bağımlılığı yoktur (Network, KV, Date.now(), Math.random()). Aynı input verildiğinde daima birebir aynı diff sonucunu üretir.

## Neden Telemetry Üretmiyor?

Diff Engine, yalnızca bir "hesaplama (computation)" katmanıdır. Güvenlik ve Separation of Concerns (SoC) prensipleri gereği:
1. İleride hem Cloudflare Worker (Edge) üzerinde hem de Node.js testlerinde çalıştırılabilir olmalıdır.
2. Analytics (AE) entegrasyonu tamamen Routing seviyesinde ele alınmalıdır.

## İleride Telemetry Katmanının Bunu Nasıl Kullanacağı

Bir sonraki aşamada (Comparison Pipeline), `[[path]].js` dosyasındaki Shadow Pipeline'ın hemen ardına bir asenkron Telemetry Worker Task'ı eklenecektir. Bu task, Diff Engine'i çağıracak ve dönen sonucun `identical: false` olduğu durumlarda (yani mismatch varsa), `items` listesini ve `repositoryResult` loglarını sıkıştırarak Analytics Engine'e (`AE_SHADOW_LOGS`) batch halinde fırlatacaktır. Bu sayede hatalı dönüşen sayfa ID'leri dashboard'da anında tespit edilebilecektir.
