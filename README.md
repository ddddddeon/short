# URL Shortener
A URL shortening service written in Typescript

## Architecture

URL Shortener runs on Google Kubernetes Engine, with ingress endpoints allowing outside access to the load-balanced web frontend, as well as Grafana dashboards for monitoring. Redis is used as a cache, and MongoDB is used for persistent storage.

![Shortener Architecture](https://user-images.githubusercontent.com/6937171/159185046-87749350-0501-4a0d-8a98-cb5cfff8cade.png)


## Web service

The web frontend allows a user to provide a URL and returns a shortened URL that redirects to the original. The frontend calls the shortening service's REST API endpoint `/shorten/:longUrl`, which generates a shortened URL and returns it to the frontend in the following format:

```http(s)://hostname/<hash>```

The shortened URL will redirect the user to the original long URL. 

## Storage and caching
Upon receiving a long URL from the user and generating a short URL, the long URL and short URL hash are stored in a MongoDB database and cached in Redis. 

It is reasonable to assume that for each user that generates a short URL, more than one other users will visit the short URL on average. For example, if someone posts the short URL on social media, multiple people will likely click the link. This is the reason caching is done on write. 

When a user clicks through a short URL link, the cache is checked first before the Mongo database. 

Redis is configured as an LRU cache with a max memory limit. If the max memory allotted to Redis is reached, the least recently used keys will be evicted first. 

## Short URL Generation implementation

The short URL generation mechanism is implemented using MD5 hashing. The original URL string is MD5-hashed with an initial salt of `"0"`:

```
md5("https://unity.com", "0") -> 10703ec7bdfff90b4444523f02392ae9
```

Then, each byte of the hash is base58-encoded:

```
base58(10703ec7bdfff90b4444523f02392ae9) -> Hw5SGQJCBBR63zj2
```

The base58-encoded hash is then truncated to the first 7 characters.

```
Hw5SGQJ
```

This allows for `58 ^ 7` (approximately 2.2 trillion) unique shortened URL hashes.

Before writing the long URL and its generated hash, the service queries the database for any entries already containing that hash. If the hash exists in the database and it matches the user-supplied long URL, the existing shortened URL is returned to the user. 

If the hash exists in the database but the corresponding long URL does **not** match the one supplied by the user, a hash collision has occurred. In this case, the hashing process is restarted but with an incremented salt value. This process repeats until there is no collision. Because the first step in the generation process an MD5 hash, collisions are exceedingly rare, and are reported to monitoring services when it does occur. 


A couple of alternatives to MD5 hashing were considered:
- **A numeric counter incrementing on each request**: This would require less computation as compared to a hash, and would result in different short URLs generated for the same URL supplied by different users. However, this solution would require infrastructure to ensure that multiple instances of the web backend do not use the same number. In order to prevent this, a mechanism would be needed to assign numeric ranges to each web service instance and ensure consistency, for example Apache Zookeeper. The user could also overload the system's storage by repeatedly generating short URLs for the same input, resulting in a new entry in the database each time. An attacker could also enumerate short URLs and visit other user's short URLs by incrementing or decrementing the generated number.

- **Random string generation**: This solution would also be nondeterministic, allowing users to generate unique short URLs even for the same long URL, but would also be vulnerable to situations where an attacker repeatedly gives the system the same URL, generating a unique item in the database each time. Compared to a deterministic hashing mechanism, collisions could occur more frequently, and as the number of items in the database increases, the likelihood of collisions would increase.

- **A lookup table of short URL codes**: Having an external service that generates a large number of unique short URL codes and storing it in a database would reduce computational overhead on the web service, but more attention would have to be paid to ensure that each short URL code is consumed exactly once, and if the short URL code lookup database/service becomes unavailable, the URL shortening service becomes unusable. 

While deterministic MD5 hashing and base58-encoding is more computationally intensive, uniqueness is more easily achieved and collisions are much rarer. Because hashing is CPU-bound, it is also a clear and easy metric to keep track of to determine autoscaling policies. If a web service instance is consistently using a lot of CPU, it is most likely busy computing hashes, thus the service should be scaled horizontally.

## Monitoring

The web service exposes a `/metrics` endpoint that provides various data to a Prometheus server. The service is instrumented to provide data such as:

- Number of cache hits
- Number of URLs shortened
- Time taken to generate a short URL
- Time taken to retrieve a long URL from the cache or database

The kubernetes cluster contains a prometheus server and a grafana frontend with dashboards that perform PromQL queries on data provided by Prometheus.

## Limitations and TODOs
- There is currently a 1:1 ratio of long URL to short URL, meaning if multiple users supply the same long URL, the same short URL will be returned to all of them. In this use case it is not a problem but for other use cases this may not be desirable behaviour. 
- Server logs are not sent anywhere. An Elasticsearch/Logstash/Kibana setup could be used to ingest logs. 
- The MongoDB pod in the kubernetes cluster is not backed by persistent storage, but in a real production environment the data should be written to a volume that persists even if the pod restarts.
- SSL is not yet enabled.



