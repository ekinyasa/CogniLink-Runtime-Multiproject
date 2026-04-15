
# --- PARAMETERS ---
ALIAS="multi-campaign-experiment"
V1="multi-campaign-igbio"
V2="multi-campaign-yt"
CONV_CHANCE_V1=20  # %20 conversion probability for variant 1
CONV_CHANCE_V2=5   # %5 conversion probability for variant 2
REQUESTS=${1:-50}  # Default 50 requests if not specified

# --- COUNTERS ---
COUNT_V1=0; CLICK_V1=0; CONV_V1=0
COUNT_V2=0; CLICK_V2=0; CONV_V2=0

echo "🚀 Simulation started: $REQUESTS requests for $ALIAS"
echo "Probabilities: $V1 ($CONV_CHANCE_V1%), $V2 ($CONV_CHANCE_V2%)"
echo "--------------------------------------------------------"

for ((i=1; i<=REQUESTS; i++)); do
  ID=$RANDOM
  COOKIE="/tmp/sim_$ID.txt"
  UA="SimBot-$ID"

  # 1. Exposure (Gösterim)
  curl -s -A "$UA" -c $COOKIE "http://127.0.0.1:8788/$ALIAS" > /dev/null
  V=$(grep "exp_$ALIAS" $COOKIE | awk '{print $NF}')

  if [ -z "$V" ]; then
    echo "⚠️ Warning: Could not detect variant for request $i"
    rm -f $COOKIE
    continue
  fi

  # 2. Click (Tıklama) - Always fire one click
  curl -s -X POST "http://127.0.0.1:8788/api/event" \
    -H "Content-Type: application/json" \
    -A "$UA" \
    -d "{
      \"utm_experiment\": \"$ALIAS\",
      \"utm_variant\": \"$V\",
      \"utm_source\": \"simulation\",
      \"dest_host\": \"target.com\"
    }" > /dev/null

  # Update local counters
  if [ "$V" == "$V1" ]; then
    ((COUNT_V1++))
    ((CLICK_V1++))
    
    # 3. Conversion (Dönüşüm)
    if [ $((RANDOM % 100)) -lt $CONV_CHANCE_V1 ]; then
      curl -s -X POST "http://127.0.0.1:8788/api/convert" \
        -H "Content-Type: application/json" \
        -d "{\"event\":\"sale\",\"experiment\":\"$ALIAS\",\"variant\":\"$V\"}" > /dev/null
      ((CONV_V1++))
    fi
  else
    ((COUNT_V2++))
    ((CLICK_V2++))
    
    # 3. Conversion (Dönüşüm)
    if [ $((RANDOM % 100)) -lt $CONV_CHANCE_V2 ]; then
      curl -s -X POST "http://127.0.0.1:8788/api/convert" \
        -H "Content-Type: application/json" \
        -d "{\"event\":\"sale\",\"experiment\":\"$ALIAS\",\"variant\":\"$V\"}" > /dev/null
      ((CONV_V2++))
    fi
  fi

  # Progress indicator
  if (( i % 10 == 0 )); then echo "Progress: $i / $REQUESTS..."; fi
  
  rm -f $COOKIE
done

echo "--------------------------------------------------------"
echo "✅ SIMULATION COMPLETE"
echo "Variant: $V1 | Traffic: $COUNT_V1 | Clicks: $CLICK_V1 | Conversions: $CONV_V1"
echo "Variant: $V2 | Traffic: $COUNT_V2 | Clicks: $CLICK_V2 | Conversions: $CONV_V2"
echo "TOTAL | Traffic: $((COUNT_V1+COUNT_V2)) | Clicks: $((CLICK_V1+CLICK_V2)) | Conversions: $((CONV_V1+CONV_V2))"
echo "--------------------------------------------------------"