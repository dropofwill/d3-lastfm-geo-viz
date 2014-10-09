require "pp"
require "json"
require 'active_support/core_ext/hash/keys'

require "lastfm"
require "echowrap"
require "geocoder"

lastfm_api = 'f57374fbe33252079a7e04762f7925cc'
lastfm_secret =  '2f1eca4a50eddfd17568430a9182b14a'

echo_api = 'DDP9J5HAUE4JGKHOS'
echo_consumer = '3c62a016eb4c18a34c663d45c7b10b82'
echo_secret = 'tTwxC/pCTjCAxazjf8t8rA'

lastfm = Lastfm.new(lastfm_api, lastfm_secret)

Echowrap.configure do |config|
  config.api_key = echo_api
  config.consumer_key = echo_consumer
  config.shared_secret = echo_secret
end

# no rate limiting on nominatim, but slow
#Geocoder.configure(
  #lookup: :nominatim,
  #http_headers: { "User-Agent" => "Will Paul, whp3652@rit.edu" }
#)

#token = lastfm.auth.get_token
#lastfm.session = lastfm.auth.get_session(token: token)["key"]

#tracks = lastfm.user.get_recent_tracks(user: "Control_is_Dead", limit: 50)
#artists = lastfm.library.get_artists(user: "Control_is_Dead", limit: 25)
#artists = lastfm.library.get_artists(user: "Control_is_Dead", limit: 2)

#pp artists[0]
#p artists[0]["page"].to_i
#artist1 = Echowrap.artist_profile(id: 'musicbrainz:artist:0ebdf343-c489-4293-af55-0be1029003fe', bucket: "artist_location")
#pp artist1

def get_artists(auth, all=true, batch=200, start=1, num=1)
  artists = []
  i = start

  if not all
    response = auth.library.get_artists(user: "Control_is_Dead", limit: batch, page: i)[0]
    cur_page = response["page"].to_i
    total_pages = response["totalPages"].to_i

    artists = artists + response["artist"]
  else
    loop do
      response = auth.library.get_artists(user: "Control_is_Dead", limit: batch, page: i)[0]
      cur_page = response["page"].to_i
      total_pages = response["totalPages"].to_i

      artists = artists + response["artist"]

      p "Current: #{cur_page} Total: #{total_pages} Page: #{i}"

      sleep(1)
      i += 1
      break if cur_page == total_pages
    end
  end

  return artists
end

def get_location(artists, output="./data_output_3.json")
  rate_start_time = start_time = Time.now
  no_echo_count = 0
  artist_count = artists.count
  rate_limit_remaining = Float::MAX

  artists.each_with_index do |artist, i|
    artist.symbolize_keys!
    #pp artist

    if artist[:echo].nil?
      foreign_id = "musicbrainz:artist:#{artist[:mbid]}"
      echo_response = Echowrap.artist_profile(id: foreign_id, bucket: ["artist_location", "genre", "hotttnesss", "hotttnesss_rank", "familiarity", "familiarity_rank", "years_active", "discovery_rank"])
      rate_limit_remaining = echo_response.to_hash[:response_headers][:"x-ratelimit-remaining"].to_i

      #pp echo_response.to_hash.keys.sort
      echo_hash = echo_response.to_hash
      echo_artist = echo_hash[:body][:response][:artist]

      p echo_artist

      #echo_artist_location = echo_artist[:artist_location]
      #pp echo_artist_location

      if echo_artist.nil?
        artist[:echo] = false
        no_echo_count += 1
      else
        # Use last fm for key conflicts
        artist[:echo] = true
        artist.merge!(echo_artist) { |k, v1, v2| v1 }

        #pp echo_artist
        if !echo_artist[:artist_location].nil?
          if !echo_artist[:artist_location][:location].nil?
            geo_response = get_lat_lon(echo_artist[:artist_location][:location])

            if geo_response
              artist[:geocode] = geo_response
            # sometimes the regions don't get geocoded properly
            # so when it fails use a less specific query
            else
              city = echo_artist[:artist_location][:city]
              country = echo_artist[:artist_location][:country]
              location_query = "#{city}, #{country}"
              artist[:geocode] = get_lat_lon(location_query)
            end
          end
        end
      end

      # backup results every ten iterations
      # while waiting for google to let us continue
      if i % 10 == 0
        File.open("echonest_data/output.json", "w") do |f|
          f.write(JSON.pretty_generate(artists))
        end
        sleep(1)
      end
    else
      p "Old #{artist[:name]}"
    end

    if rate_limit_remaining <= 0
      p "sleeeping #{i}"
      # time until rate limit gets reset
      sleep(61)
      rate_start_time = Time.now
    end

    # Final output
    File.open(output, "w") do |f|
      f.write(JSON.pretty_generate(artists))
    end
  end

  puts "Echo data unavailable for #{no_echo_count} artists"
  puts "Completed #{artist_count} artists in #{(Time.now - start_time) / 60} minutes"
  return artists
end

def get_lat_lon(location)
  results = Geocoder.search(location)

  if results[0].nil?
    return false
  else
    return results[0].data["geometry"]["location"]
  end
end

#pp get_lat_lon("Tokyo, Japan")
#
#artists = get_artists(lastfm, true, 200)
#artists_profiles = get_location(artists)

fm_data = File.read("./data_output_2.json")
fm_hash = JSON.parse(fm_data)
artists_profiles = get_location(fm_hash)
