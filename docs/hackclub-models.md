# Hack Club AI model list

Fetched 2026-11-14 from `GET https://ai.hackclub.com/proxy/v1/models` (no key needed) and `GET .../embeddings/models`.

| Model | Input | Output | $/M in | $/M out | Context |
|---|---|---|---|---|---|
| ~anthropic/claude-fable-latest | text, image, file | text | 8.000 | 40.000 | 1000000 |
| ~anthropic/claude-haiku-latest | text, image, file | text | 0.100 | 0.500 | 1000000 |
| ~anthropic/claude-opus-latest | text, image, file | text | 4.000 | 20.000 | 1000000 |
| ~anthropic/claude-sonnet-latest | text, image, file | text | 2.000 | 10.000 | 1000000 |
| ~deepseek/deepseek-flash-latest | text, image | text | 0.038 | 0.500 | 1048576 |
| ~deepseek/deepseek-pro-latest | text | text | 0.100 | 8.000 | 1048576 |
| ~deepseek/deepseek-v4-flash-latest | text | text | 0.043 | 0.300 | 1048576 |
| ~google/gemini-flash-latest | audio, file, image, text, video | text | 1.500 | 7.500 | 1048576 |
| ~google/gemini-pro-latest | audio, file, image, text, video | text | 2.000 | 10.000 | 1048576 |
| ~moonshotai/kimi-latest | text, image, video | text | 0.182 | 11.005 | 1048576 |
| ~openai/gpt-astra-latest | file, image, text | text | 10.000 | 50.000 | 1050000 |
| ~openai/gpt-luna-latest | file, image, text | text | 0.100 | 0.500 | 1050000 |
| ~openai/gpt-mini-latest | file, image, text | text | 0.750 | 4.500 | 400000 |
| ~openai/gpt-sol-latest | file, image, text | text | 2.000 | 10.000 | 1050000 |
| ~openai/gpt-terra-latest | file, image, text | text | 1.000 | 5.000 | 1050000 |
| ~unbiased/pareto-latest | text, image | text | 0.800 | 3.200 | 1048576 |
| ~x-ai/grok-latest | text, image, file | text | 2.000 | 6.000 | 500000 |
| ~z-ai/glm-flash-latest | text, image, video | text | 0.040 | 0.078 | 1048576 |
| ~z-ai/glm-latest | text | text | 0.070 | 1.400 | 1048576 |
| aion-labs/aion-2.0 | text | text | 0.800 | 1.600 | 131072 |
| aion-labs/aion-3.0 | text | text | 3.000 | 6.000 | 131072 |
| aion-labs/aion-3.0-mini | text | text | 0.700 | 1.400 | 131072 |
| aion-labs/aion-3.5 | text | text | 3.000 | 6.000 | 262144 |
| aion-labs/aion-3.5-mini | text | text | 0.700 | 1.400 | 262144 |
| aion-labs/aion-rp-llama-3.1-8b | text | text | 0.800 | 1.600 | 32768 |
| amazon/nova-2-lite-v1 | text, image, video, file | text | 0.300 | 2.500 | 1000000 |
| amazon/nova-lite-v1 | text, image | text | 0.060 | 0.240 | 300000 |
| amazon/nova-micro-v1 | text | text | 0.035 | 0.140 | 128000 |
| amazon/nova-premier-v1 | text, image | text | 2.500 | 12.500 | 1000000 |
| amazon/nova-pro-v1 | text, image | text | 0.800 | 3.200 | 300000 |
| amazon/titan-embed-image-v1 | text, image | embeddings | 0.800 | 0.000 | 128 |
| amazon/titan-embed-text-v1 | text | embeddings | 0.100 | 0.000 | 8192 |
| amazon/titan-embed-text-v2 | text | embeddings | 0.020 | 0.000 | 8192 |
| anthracite-org/magnum-v4-72b | text | text | 2.500 | 5.000 | 32768 |
| anthropic/claude-fable-5 | text, image, file | text | 10.000 | 50.000 | 1000000 |
| anthropic/claude-fable-5.1 | text, image, file | text | 10.000 | 50.000 | 1000000 |
| anthropic/claude-fable-5.2 | text, image, file | text | 8.000 | 40.000 | 1000000 |
| anthropic/claude-haiku-4.5 | text, image, file | text | 1.000 | 5.000 | 200000 |
| anthropic/claude-haiku-5.5 | text, image, file | text | 0.100 | 0.500 | 1000000 |
| anthropic/claude-opus-4.1 | image, text, file | text | 15.000 | 75.000 | 200000 |
| anthropic/claude-opus-4.5 | file, image, text | text | 5.000 | 25.000 | 200000 |
| anthropic/claude-opus-4.6 | text, image, file | text | 5.000 | 25.000 | 1000000 |
| anthropic/claude-opus-4.7 | text, image, file | text | 5.000 | 25.000 | 1000000 |
| anthropic/claude-opus-4.8 | text, image, file | text | 5.000 | 25.000 | 1000000 |
| anthropic/claude-opus-5 | text, image, file | text | 5.000 | 25.000 | 1000000 |
| anthropic/claude-opus-5.5 | text, image, file | text | 4.000 | 20.000 | 1000000 |
| anthropic/claude-sonnet-4.5 | text, image, file | text | 3.000 | 15.000 | 1000000 |
| anthropic/claude-sonnet-4.6 | text, image, file | text | 3.000 | 15.000 | 1000000 |
| anthropic/claude-sonnet-5 | text, image, file | text | 2.000 | 10.000 | 1000000 |
| anthropic/claude-sonnet-5.5 | text, image, file | text | 2.000 | 10.000 | 1000000 |
| baai/bge-base-en-v1.5 | text | embeddings | 0.005 | 0.000 | 512 |
| baai/bge-large-en-v1.5 | text | embeddings | 0.010 | 0.000 | 512 |
| baai/bge-m3 | text | embeddings | 0.010 | 0.000 | 8194 |
| baidu/ernie-5.5-flash-preview:free | text | text | 0.000 | 0.000 | 1024000 |
| baidu/ernie-light-dt-1.0-intl | text | text | 1.130 | 3.940 | 1024000 |
| bytedance-seed/seed-2-1-turbo | text, image, video | text | 0.500 | 2.500 | 262144 |
| bytedance-seed/seed-2.0-lite | text, image, video | text | 0.250 | 2.000 | 262144 |
| bytedance-seed/seed-2.0-mini | text, image, video | text | 0.100 | 0.400 | 262144 |
| bytedance/ui-tars-1.5-7b | image, text | text | 0.100 | 0.200 | 128000 |
| cognitivecomputations/dolphin-mistral-24b-venice-edition | text | text | 0.200 | 0.900 | 128000 |
| cohere/command-a | text | text | 2.500 | 10.000 | 256000 |
| cohere/command-a-plus | text, image | text | 0.300 | 1.500 | 192000 |
| cohere/command-r-08-2024 | text | text | 0.150 | 0.600 | 128000 |
| cohere/command-r-plus-08-2024 | text | text | 2.500 | 10.000 | 128000 |
| cohere/command-r7b-12-2024 | text | text | 0.037 | 0.150 | 128000 |
| cohere/embed-5-fast | text, image | embeddings | 0.080 | 0.000 | 128000 |
| cohere/embed-5-pro | text, image | embeddings | 0.120 | 0.000 | 128000 |
| cohere/north-mini-code:free | text | text | 0.000 | 0.000 | 256000 |
| deepseek/deepseek-chat | text | text | 0.257 | 1.029 | 163840 |
| deepseek/deepseek-chat-v3-0324 | text | text | 0.290 | 1.140 | 163840 |
| deepseek/deepseek-chat-v3.1 | text | text | 0.250 | 0.950 | 163840 |
| deepseek/deepseek-r1-0528 | text | text | 0.571 | 2.286 | 163840 |
| deepseek/deepseek-v3.1-terminus | text | text | 0.270 | 1.000 | 163840 |
| deepseek/deepseek-v3.2 | text | text | 0.260 | 0.380 | 163840 |
| deepseek/deepseek-v3.2-exp | text | text | 0.270 | 0.410 | 163840 |
| deepseek/deepseek-v4-flash | text | text | 0.090 | 0.180 | 1048576 |
| deepseek/deepseek-v4-flash-0731 | text | text | 0.043 | 0.300 | 1048576 |
| deepseek/deepseek-v4-flash-vision-exp | text, image | text | 0.440 | 1.320 | 1048576 |
| deepseek/deepseek-v4-pro | text | text | 0.900 | 1.500 | 1048576 |
| deepseek/deepseek-v4-pro-0813 | text | text | 0.111 | 4.440 | 1048576 |
| deepseek/deepseek-v4.1-flash | text, image | text | 0.051 | 0.203 | 1048576 |
| deepseek/deepseek-v4.1-flash-1017 | text, image | text | 0.038 | 0.500 | 1048576 |
| dots-studio/dots-3-note-preview:free | text, image | text | 0.000 | 0.000 | 512000 |
| elorian/glimpse | text, image, video | text | 0.600 | 3.000 | 262144 |
| fireworks/ember-1 | text, image | text | 3.000 | 15.000 | 1048576 |
| google/gemini-2.5-flash | file, image, text, audio, video | text | 0.300 | 2.500 | 1048576 |
| google/gemini-2.5-flash-image | image, text | image, text | 0.300 | 2.500 | 32768 |
| google/gemini-2.5-flash-lite | text, image, file, audio, video | text | 0.100 | 0.400 | 1048576 |
| google/gemini-2.5-pro | text, image, file, audio, video | text | 1.250 | 10.000 | 1048576 |
| google/gemini-2.5-pro-preview | file, image, text, audio | text | 1.250 | 10.000 | 1048576 |
| google/gemini-3-flash-preview | text, image, file, audio, video | text | 0.500 | 3.000 | 1048576 |
| google/gemini-3-pro-image | image, text | image, text | 2.000 | 12.000 | 131072 |
| google/gemini-3-pro-image-preview | image, text | image, text | 2.000 | 12.000 | 65536 |
| google/gemini-3.1-flash-image | image, text | image, text | 0.500 | 3.000 | 131072 |
| google/gemini-3.1-flash-image-preview | image, text | image, text | 0.500 | 3.000 | 65536 |
| google/gemini-3.1-flash-lite | text, image, video, file, audio | text | 0.250 | 1.500 | 1048576 |
| google/gemini-3.1-flash-lite-image | image, text | image, text | 0.250 | 1.500 | 65536 |
| google/gemini-3.1-flash-lite-preview | text, image, video, file, audio | text | 0.250 | 1.500 | 1048576 |
| google/gemini-3.1-pro-preview | audio, file, image, text, video | text | 2.000 | 12.000 | 1048576 |
| google/gemini-3.1-pro-preview-customtools | text, audio, image, video, file | text | 2.000 | 12.000 | 1048576 |
| google/gemini-3.5-flash | text, image, video, file, audio | text | 1.500 | 9.000 | 1048576 |
| google/gemini-3.5-flash-lite | text, image, video, file, audio | text | 0.300 | 2.500 | 1048576 |
| google/gemini-3.6-flash | text, image, video, file, audio | text | 0.750 | 3.750 | 1048576 |
| google/gemini-3.7-flash | text, image, video, file, audio | text | 0.750 | 3.750 | 1048576 |
| google/gemini-3.8-flash | text, image, video, file, audio | text | 0.825 | 4.125 | 1048576 |
| google/gemini-4-argon | audio, file, image, text, video | text | 2.000 | 10.000 | 1048576 |
| google/gemini-4-carbon | audio, file, image, text, video | text | 2.000 | 10.000 | 1048576 |
| google/gemini-4-hydrogen | audio, file, image, text, video | text | 1.500 | 7.500 | 1048576 |
| google/gemini-embedding-001 | text | embeddings | 0.150 | 0.000 | 20000 |
| google/gemini-embedding-2 | text, image, file, audio, video | embeddings | 0.200 | 0.000 | 8192 |
| google/gemini-embedding-2-preview | text, image, file, audio, video | embeddings | 0.200 | 0.000 | 8192 |
| google/gemini-nano-banana-2.1 | image, text | image, text | 1.500 | 7.500 | 65536 |
| google/gemini-omni-1.1-flash | text, image, video | text, video | 1.500 | 9.000 | 131072 |
| google/gemini-omni-1.2-flash | text, image, video | text, video | 1.500 | 9.000 | 131072 |
| google/gemma-2-27b-it | text | text | 0.650 | 0.650 | 8192 |
| google/gemma-3-12b-it | text, image | text | 0.050 | 0.150 | 131072 |
| google/gemma-3-27b-it | text, image | text | 0.080 | 0.350 | 131072 |
| google/gemma-3-4b-it | text, image | text | 0.050 | 0.100 | 131072 |
| google/gemma-4-26b-a4b-it | image, text, video | text | 0.068 | 0.225 | 262144 |
| google/gemma-4-26b-a4b-it:free | image, text, video | text | 0.000 | 0.000 | 262144 |
| google/gemma-4-31b-it | image, text, video | text | 0.200 | 0.400 | 262144 |
| google/gemma-4-31b-it:free | image, text, video | text | 0.000 | 0.000 | 262144 |
| google/lyria-3-clip-preview | text, image | text, audio | 0.000 | 0.000 | 1048576 |
| google/lyria-3-pro-preview | text, image | text, audio | 0.000 | 0.000 | 1048576 |
| gryphe/mythomax-l2-13b | text | text | 0.080 | 0.110 | 8192 |
| ibm-granite/granite-4.2-8b | text | text | 0.060 | 0.250 | 131072 |
| inclusionai/ling-3.0-flash | text | text | 0.021 | 0.063 | 262144 |
| inclusionai/ling-3.0-flash-vl | text, image, video | text | 0.060 | 0.180 | 131072 |
| inclusionai/ling-3.0-tiny | text | text | 0.015 | 0.045 | 262144 |
| inclusionai/ling-3.1-flash | text | text | 0.045 | 0.135 | 1000000 |
| inclusionai/ling-3.2-flash:free | text, image | text | 0.000 | 0.000 | 1048576 |
| inference-net/schematron-v2-small | text | text | 0.050 | 0.230 | 128000 |
| inference-net/schematron-v2-turbo | text | text | 0.030 | 0.150 | 128000 |
| intfloat/e5-base-v2 | text | embeddings | 0.005 | 0.000 | 512 |
| intfloat/e5-large-v2 | text | embeddings | 0.010 | 0.000 | 512 |
| intfloat/multilingual-e5-large | text | embeddings | 0.010 | 0.000 | 512 |
| kt/midm-k-3.0-pro | text | text | 0.200 | 0.800 | 261795 |
| liquid/lfm-2.5-24b-a2b | text | text | 0.050 | 0.700 | 128000 |
| liquid/lfm-3-1.7b | text | text | 0.080 | 0.200 | 262144 |
| liquid/lfm-3-1.7b:free | text | text | 0.000 | 0.000 | 262144 |
| mancer/weaver | text | text | 0.300 | 0.500 | 8000 |
| meituan/longcat-2.0 | text | text | 0.300 | 1.200 | 1048756 |
| meta-llama/llama-3.1-70b-instruct | text | text | 0.720 | 0.720 | 131072 |
| meta-llama/llama-3.1-8b-instruct | text | text | 0.020 | 0.040 | 131072 |
| meta-llama/llama-3.2-1b-instruct | text | text | 0.027 | 0.201 | 60000 |
| meta-llama/llama-3.2-3b-instruct | text | text | 0.051 | 0.335 | 131072 |
| meta-llama/llama-3.3-70b-instruct | text | text | 0.710 | 0.710 | 131072 |
| meta-llama/llama-4-maverick | text, image | text | 0.350 | 1.000 | 524288 |
| meta-llama/llama-4-scout | text, image | text | 0.100 | 0.300 | 1310720 |
| meta-llama/llama-guard-4-12b | image, text | text | 0.180 | 0.180 | 163840 |
| meta/muse-ember | text, image, video, file, audio | text | 0.100 | 0.500 | 1048576 |
| meta/muse-glimmer-30b | text, image | text | 0.300 | 1.200 | 131072 |
| meta/muse-spark-1.1 | text, image, video, file | text | 1.250 | 4.250 | 1048576 |
| meta/muse-spark-1.2 | text, image, video, file | text | 1.250 | 4.250 | 1048576 |
| meta/muse-spark-1.2-contributor | text, image, video, file | text | 0.100 | 0.200 | 1048576 |
| meta/muse-spark-1.3 | text, image, video, file | text | 1.250 | 4.250 | 1048576 |
| meta/muse-spark-1.3-contributor | text, image, video, file | text | 0.100 | 0.200 | 1048576 |
| meta/muse-spark-open | text, image, video, file, audio | text | 1.250 | 4.250 | 1048576 |
| meta/muse-wonder | text, image, video, file, audio | text | 4.000 | 20.000 | 1048576 |
| microsoft/phi-4 | text | text | 0.070 | 0.140 | 16384 |
| minimax/minimax-m2.5 | text | text | 0.270 | 0.950 | 198000 |
| minimax/minimax-m2.7 | text | text | 0.210 | 0.840 | 196608 |
| minimax/minimax-m3 | text, image, video | text | 0.300 | 1.200 | 1048576 |
| minimax/minimax-m3.1-flash | text, image, video | text | 0.075 | 0.300 | 1048576 |
| mistralai/codestral-2508 | text, file | text | 0.300 | 0.900 | 256000 |
| mistralai/codestral-embed-2505 | text | embeddings | 0.150 | 0.000 | 8192 |
| mistralai/devstral-2512 | text, file | text | 0.400 | 2.000 | 262144 |
| mistralai/ministral-14b-2512 | text, image | text | 0.200 | 0.200 | 262144 |
| mistralai/ministral-3b-2512 | text, image | text | 0.100 | 0.100 | 131072 |
| mistralai/ministral-8b-2512 | text, image | text | 0.150 | 0.150 | 262144 |
| mistralai/mistral-embed-2312 | text | embeddings | 0.100 | 0.000 | 8192 |
| mistralai/mistral-large | text, file | text | 2.000 | 6.000 | 128000 |
| mistralai/mistral-large-2407 | text, file | text | 2.000 | 6.000 | 131072 |
| mistralai/mistral-large-2512 | text, image, file | text | 0.500 | 1.500 | 262144 |
| mistralai/mistral-large-4-0 | text, image | text | 0.700 | 2.100 | 1048576 |
| mistralai/mistral-medium-3 | text, image, file | text | 0.400 | 2.000 | 131072 |
| mistralai/mistral-medium-3-5 | text, image, file | text | 1.500 | 7.500 | 262144 |
| mistralai/mistral-medium-3.1 | text, image, file | text | 0.400 | 2.000 | 131072 |
| mistralai/mistral-nemo | text | text | 0.029 | 0.030 | 131072 |
| mistralai/mistral-saba | text, file | text | 0.200 | 0.600 | 32768 |
| mistralai/mistral-small-24b-instruct-2501 | text | text | 0.050 | 0.080 | 32768 |
| mistralai/mistral-small-2603 | text, image | text | 0.150 | 0.600 | 262144 |
| mistralai/mistral-small-3.1-24b-instruct | text, image | text | 0.351 | 0.555 | 128000 |
| mistralai/mistral-small-3.2-24b-instruct | image, text | text | 0.100 | 0.300 | 256000 |
| mistralai/mixtral-8x22b-instruct | text, file | text | 2.000 | 6.000 | 65536 |
| mistralai/voxtral-small-24b-2507 | text, audio, file | text | 0.100 | 0.300 | 32768 |
| mongodb/voyage-4 | text | embeddings | 0.060 | 0.000 | 32000 |
| mongodb/voyage-4-large | text | embeddings | 0.120 | 0.000 | 32000 |
| mongodb/voyage-4-lite | text | embeddings | 0.020 | 0.000 | 32000 |
| mongodb/voyage-code-4 | text | embeddings | 0.120 | 0.000 | 32000 |
| mongodb/voyage-multimodal-3.5 | text, image | embeddings | 0.120 | 0.000 | 32000 |
| moondream/moondream3-preview | text, image | text | 0.300 | 2.500 | 32000 |
| moondream/moondream3.1-9b-a2b | text, image | text | 0.300 | 2.500 | 32000 |
| moonshotai/kimi-k2 | text | text | 0.570 | 2.300 | 131072 |
| moonshotai/kimi-k2-0905 | text | text | 0.600 | 2.500 | 262144 |
| moonshotai/kimi-k2-thinking | text | text | 0.600 | 2.500 | 262144 |
| moonshotai/kimi-k2.5 | text, image | text | 0.500 | 2.500 | 262144 |
| moonshotai/kimi-k2.6 | text, image | text | 0.650 | 3.410 | 262144 |
| moonshotai/kimi-k2.7-code | text, image | text | 0.600 | 3.500 | 262144 |
| moonshotai/kimi-k3 | text, image, video | text | 0.192 | 16.000 | 1048576 |
| moonshotai/kimi-k3.1-pro | text, image, video | text | 2.000 | 10.000 | 1048576 |
| morph/morph-v3-fast | text | text | 0.800 | 1.200 | 262144 |
| morph/morph-v3-large | text | text | 0.900 | 1.900 | 262144 |
| motif-technologies/motif-3 | text | text | 0.300 | 1.200 | 262144 |
| nex-agi/nex-n2.5-mini | text, image | text | 0.025 | 0.100 | 262144 |
| nex-agi/nex-n2.5-pro | text, image | text | 0.075 | 0.250 | 262144 |
| nex-agi/nex-n2.6 | text, image | text | 0.120 | 0.400 | 262144 |
| nousresearch/hermes-4-405b | text | text | 1.000 | 3.000 | 131072 |
| nvidia/llama-nemotron-embed-vl-1b-v2:free | text, image | embeddings | 0.000 | 0.000 | 131072 |
| nvidia/nemotron-3-embed-1b:free | text | embeddings | 0.000 | 0.000 | 32768 |
| nvidia/nemotron-3-nano-30b-a3b | text | text | 0.060 | 0.240 | 262144 |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | text, audio, image, video | text | 0.000 | 0.000 | 256000 |
| nvidia/nemotron-3-super-120b-a12b | text | text | 0.075 | 0.400 | 262144 |
| nvidia/nemotron-3-ultra-550b-a55b | text | text | 0.600 | 2.400 | 262144 |
| nvidia/nemotron-3-ultra-550b-a55b:free | text | text | 0.000 | 0.000 | 1000000 |
| nvidia/nemotron-3.5-content-safety | text, image | text | 0.200 | 0.200 | 131072 |
| nvidia/nemotron-3.5-embed-1b:free | text, image | embeddings | 0.000 | 0.000 | 32768 |
| nvidia/nemotron-3.5-embed-8b:free | text, image | embeddings | 0.000 | 0.000 | 32768 |
| nvidia/nemotron-3.5-lightning | text | text | 0.070 | 0.200 | 262144 |
| nvidia/nemotron-3.5-lightning:free | text | text | 0.000 | 0.000 | 1000000 |
| nvidia/nemotron-3.5-super-vl | text, image, video | text | 0.150 | 0.470 | 1048576 |
| nvidia/nemotron-3.5-super-vl:free | text, image, video | text | 0.000 | 0.000 | 1000000 |
| nvidia/switchyard | text | text | -1000000.000 | -1000000.000 | 1000000 |
| openai/gpt-3.5-turbo-0613 | text | text | 1.000 | 2.000 | 4095 |
| openai/gpt-3.5-turbo-16k | text | text | 3.000 | 4.000 | 16385 |
| openai/gpt-4 | text | text | 30.000 | 60.000 | 8191 |
| openai/gpt-4.1 | image, text, file | text | 2.000 | 8.000 | 1047576 |
| openai/gpt-4.1-mini | image, text, file | text | 0.400 | 1.600 | 1047576 |
| openai/gpt-4.1-nano | image, text, file | text | 0.100 | 0.400 | 1047576 |
| openai/gpt-4o | text, image, file | text | 2.500 | 10.000 | 128000 |
| openai/gpt-4o-2024-05-13 | text, image, file | text | 5.000 | 15.000 | 128000 |
| openai/gpt-4o-2024-08-06 | text, image, file | text | 2.500 | 10.000 | 128000 |
| openai/gpt-4o-2024-11-20 | text, image, file | text | 2.500 | 10.000 | 128000 |
| openai/gpt-4o-mini | text, image, file | text | 0.150 | 0.600 | 128000 |
| openai/gpt-4o-mini-2024-07-18 | text, image, file | text | 0.150 | 0.600 | 128000 |
| openai/gpt-5 | text, image, file | text | 1.250 | 10.000 | 400000 |
| openai/gpt-5-image | image, text, file | image, text | 10.000 | 10.000 | 400000 |
| openai/gpt-5-image-mini | file, image, text | image, text | 2.500 | 2.000 | 400000 |
| openai/gpt-5-mini | text, image, file | text | 0.250 | 2.000 | 400000 |
| openai/gpt-5-nano | text, image, file | text | 0.050 | 0.400 | 400000 |
| openai/gpt-5-pro | image, text, file | text | 15.000 | 120.000 | 400000 |
| openai/gpt-5.1 | image, text, file | text | 1.250 | 10.000 | 400000 |
| openai/gpt-5.1-codex | text, image | text | 1.250 | 10.000 | 400000 |
| openai/gpt-5.1-codex-max | text, image | text | 1.250 | 10.000 | 400000 |
| openai/gpt-5.1-codex-mini | image, text | text | 0.250 | 2.000 | 400000 |
| openai/gpt-5.2 | file, image, text | text | 1.750 | 14.000 | 400000 |
| openai/gpt-5.2-chat | file, image, text | text | 1.750 | 14.000 | 128000 |
| openai/gpt-5.2-codex | text, image | text | 1.750 | 14.000 | 400000 |
| openai/gpt-5.2-pro | image, text, file | text | 21.000 | 168.000 | 400000 |
| openai/gpt-5.3-codex | text, image, file | text | 1.750 | 14.000 | 400000 |
| openai/gpt-5.4 | text, image, file | text | 2.500 | 15.000 | 1050000 |
| openai/gpt-5.4-image-2 | image, text, file | image, text | 8.000 | 15.000 | 272000 |
| openai/gpt-5.4-mini | file, image, text | text | 0.750 | 4.500 | 400000 |
| openai/gpt-5.4-nano | file, image, text | text | 0.200 | 1.250 | 400000 |
| openai/gpt-5.4-pro | text, image, file | text | 30.000 | 180.000 | 1050000 |
| openai/gpt-5.5 | file, image, text | text | 5.000 | 30.000 | 1050000 |
| openai/gpt-5.5-pro | file, image, text | text | 30.000 | 180.000 | 1050000 |
| openai/gpt-5.6-luna | file, image, text | text | 0.200 | 1.200 | 1050000 |
| openai/gpt-5.6-luna-pro | file, image, text | text | 0.200 | 1.200 | 1050000 |
| openai/gpt-5.6-sol | file, image, text | text | 4.000 | 20.000 | 1050000 |
| openai/gpt-5.6-sol-pro | file, image, text | text | 4.000 | 20.000 | 1050000 |
| openai/gpt-5.6-terra | file, image, text | text | 2.000 | 12.000 | 1050000 |
| openai/gpt-5.6-terra-pro | file, image, text | text | 2.000 | 12.000 | 1050000 |
| openai/gpt-6-astra | file, image, text | text | 10.000 | 50.000 | 1050000 |
| openai/gpt-6-astra-pro | file, image, text | text | 10.000 | 50.000 | 1050000 |
| openai/gpt-6-luna | file, image, text | text | 0.100 | 0.500 | 1050000 |
| openai/gpt-6-luna-pro | file, image, text | text | 0.100 | 0.500 | 1050000 |
| openai/gpt-6-sol | file, image, text | text | 2.000 | 10.000 | 1050000 |
| openai/gpt-6-sol-pro | file, image, text | text | 2.000 | 10.000 | 1050000 |
| openai/gpt-6.1-sol | file, image, text | text | 2.000 | 10.000 | 1050000 |
| openai/gpt-6.1-sol-pro | file, image, text | text | 2.000 | 10.000 | 1050000 |
| openai/gpt-6.1-terra | file, image, text | text | 1.000 | 5.000 | 1050000 |
| openai/gpt-6.1-terra-pro | file, image, text | text | 1.000 | 5.000 | 1050000 |
| openai/gpt-audio | text, audio | text, audio | 2.500 | 10.000 | 128000 |
| openai/gpt-audio-mini | text, audio | text, audio | 0.600 | 2.400 | 128000 |
| openai/gpt-chat-latest | text, image, file | text | 5.000 | 30.000 | 400000 |
| openai/gpt-oss-120b | text | text | 0.150 | 0.600 | 131072 |
| openai/gpt-oss-20b | text | text | 0.030 | 0.130 | 131072 |
| openai/gpt-oss-safeguard-20b | text | text | 0.075 | 0.300 | 131072 |
| openai/o3 | image, text, file | text | 2.000 | 8.000 | 200000 |
| openai/o3-pro | text, file, image | text | 20.000 | 80.000 | 200000 |
| openai/text-embedding-3-large | text | embeddings | 0.130 | 0.000 | 8192 |
| openai/text-embedding-3-small | text | embeddings | 0.020 | 0.000 | 8192 |
| openai/text-embedding-ada-002 | text | embeddings | 0.100 | 0.000 | 8192 |
| openrouter/auto | text, image, audio, file, video | text, image | -1000000.000 | -1000000.000 | 2000000 |
| openrouter/auto-beta | text, image, audio, file, video | text, image | -1000000.000 | -1000000.000 | 2000000 |
| openrouter/auto-code | text, image, audio, file, video | text, image | -1000000.000 | -1000000.000 | 2000000 |
| openrouter/bodybuilder | text | text | -1000000.000 | -1000000.000 | 128000 |
| openrouter/free | text, image | text | 0.000 | 0.000 | 200000 |
| openrouter/fusion | text | text | -1000000.000 | -1000000.000 | 1000000 |
| openrouter/pareto-code | text | text | -1000000.000 | -1000000.000 | 2000000 |
| particle-ai/particle-1 | text, image | text | 0.060 | 0.500 | 1048576 |
| particle-ai/particle-1:free | text, image | text | 0.000 | 0.000 | 1048576 |
| perceptron/perceptron-mk1 | text, image, video | text | 0.150 | 1.500 | 32768 |
| perceptron/perceptron-mk1.5 | text, image, video, audio | text | 0.150 | 1.500 | 36864 |
| perplexity/pplx-embed-v1-0.6b | text | embeddings | 0.004 | 0.000 | 32000 |
| perplexity/pplx-embed-v1-4b | text | embeddings | 0.030 | 0.000 | 32000 |
| perplexity/sonar | text, image | text | 1.000 | 1.000 | 127072 |
| perplexity/sonar-deep-research | text | text | 2.000 | 8.000 | 128000 |
| perplexity/sonar-pro | text, image | text | 3.000 | 15.000 | 200000 |
| perplexity/sonar-pro-search | text, image | text | 3.000 | 15.000 | 200000 |
| perplexity/sonar-reasoning-pro | text, image | text | 2.000 | 8.000 | 128000 |
| prism-ml/ternary-bonsai-2-27b | text, image | text | 0.075 | 0.500 | 262144 |
| prism-ml/ternary-bonsai-2-9b | text, image | text | 0.080 | 0.130 | 262144 |
| qwen/qwen-2.5-72b-instruct | text | text | 0.360 | 0.400 | 32768 |
| qwen/qwen-2.5-coder-32b-instruct | text | text | 0.660 | 1.000 | 32768 |
| qwen/qwen-plus | text | text | 0.260 | 0.780 | 1000000 |
| qwen/qwen2.5-vl-72b-instruct | text, image | text | 0.800 | 1.000 | 128000 |
| qwen/qwen3-14b | text | text | 0.120 | 0.240 | 40960 |
| qwen/qwen3-235b-a22b-2507 | text | text | 0.140 | 0.800 | 262144 |
| qwen/qwen3-235b-a22b-thinking-2507 | text | text | 0.450 | 3.500 | 128000 |
| qwen/qwen3-30b-a3b | text | text | 0.120 | 0.500 | 40960 |
| qwen/qwen3-30b-a3b-instruct-2507 | text | text | 0.100 | 0.300 | 262144 |
| qwen/qwen3-32b | text | text | 0.080 | 0.280 | 131072 |
| qwen/qwen3-coder | text | text | 0.300 | 1.000 | 262144 |
| qwen/qwen3-coder-30b-a3b-instruct | text | text | 0.150 | 0.600 | 262144 |
| qwen/qwen3-coder-flash | text | text | 0.195 | 0.975 | 1000000 |
| qwen/qwen3-coder-next | text | text | 0.120 | 0.800 | 262144 |
| qwen/qwen3-embedding-4b | text | embeddings | 0.020 | 0.000 | 32768 |
| qwen/qwen3-embedding-8b | text | embeddings | 0.010 | 0.000 | 40960 |
| qwen/qwen3-next-80b-a3b-instruct | text | text | 0.090 | 1.100 | 262144 |
| qwen/qwen3-vl-235b-a22b-instruct | text, image | text | 0.210 | 1.900 | 262144 |
| qwen/qwen3-vl-30b-a3b-instruct | text, image | text | 0.150 | 0.600 | 262144 |
| qwen/qwen3-vl-30b-a3b-thinking | text, image | text | 0.290 | 1.000 | 262144 |
| qwen/qwen3-vl-8b-instruct | image, text | text | 0.250 | 0.750 | 262144 |
| qwen/qwen3.5-122b-a10b | text, image, video | text | 0.260 | 2.080 | 262144 |
| qwen/qwen3.5-27b | text, image, video | text | 0.260 | 2.600 | 262144 |
| qwen/qwen3.5-35b-a3b | text, image, video | text | 0.140 | 1.000 | 262144 |
| qwen/qwen3.5-397b-a17b | text, image, video | text | 0.600 | 3.600 | 262144 |
| qwen/qwen3.5-9b | text, image, video | text | 0.120 | 0.176 | 262144 |
| qwen/qwen3.5-flash-02-23 | text, image, video | text | 0.065 | 0.260 | 1000000 |
| qwen/qwen3.5-plus-02-15 | text, image, video | text | 0.260 | 1.560 | 1000000 |
| qwen/qwen3.5-plus-20260420 | text, image, video | text | 0.300 | 1.800 | 1000000 |
| qwen/qwen3.6-27b | text, image, video | text | 0.320 | 3.200 | 262144 |
| qwen/qwen3.6-35b-a3b | text, image, video | text | 0.100 | 0.900 | 262144 |
| qwen/qwen3.6-flash | text, image, video | text | 0.188 | 1.125 | 1000000 |
| qwen/qwen3.6-plus | text, image, video | text | 0.325 | 1.950 | 1000000 |
| qwen/qwen3.7-flash | text, image, video | text | 0.030 | 0.130 | 1000000 |
| qwen/qwen3.7-max | text | text | 1.475 | 4.425 | 1000000 |
| qwen/qwen3.7-plus | text, image | text | 0.320 | 1.280 | 1000000 |
| qwen/qwen3.8-2.4t-a95b | text | text | 2.000 | 6.000 | 1048576 |
| qwen/qwen3.8-27b | text, image, video | text | 0.150 | 1.875 | 1024000 |
| qwen/qwen3.8-flash | text, image, video | text | 0.150 | 0.470 | 1000000 |
| qwen/qwen3.8-max-0902 | text, image, video | text | 2.000 | 6.000 | 1000000 |
| qwen/qwen3.8-max-prime | text, image, video | text | 4.000 | 12.000 | 1000000 |
| qwen/qwen3.8-omni-flash | text, image, audio, video | text | 0.150 | 0.470 | 1000000 |
| recursive/flint-v1.0:free | text | text | 0.000 | 0.000 | 262144 |
| reflection/beam-1.0-501b-a23b | text | text | 0.300 | 1.000 | 1048576 |
| rekaai/reka-edge | image, text, video | text | 0.100 | 0.100 | 16384 |
| rekaai/reka-flash-3 | text | text | 0.100 | 0.200 | 65536 |
| relace/relace-apply-3 | text | text | 0.850 | 1.250 | 256000 |
| relace/relace-search | text | text | 1.000 | 3.000 | 256000 |
| ricursiveai/ripple-65b-preview | text | text | 0.100 | 0.300 | 1048576 |
| sakana/fugu-max | text, image, file | text | 2.000 | 6.000 | 1000000 |
| sakana/fugu-ultra | text, image | text | 5.000 | 30.000 | 1000000 |
| sakana/fugu-ultra-v2 | text, image, file | text | 5.000 | 30.000 | 1000000 |
| sakana/sakana-namazu | text, image, file | text | 0.950 | 4.000 | 262144 |
| sao10k/l3-lunaris-8b | text | text | 0.040 | 0.050 | 8192 |
| sao10k/l3.1-euryale-70b | text | text | 0.850 | 0.850 | 131072 |
| scaledown/extract | text, image, file | text | 0.040 | 0.000 | 1000000 |
| scaledown/summarize | text, image, file | text | 0.040 | 0.000 | 1000000 |
| sentence-transformers/all-minilm-l12-v2 | text | embeddings | 0.005 | 0.000 | 512 |
| sentence-transformers/all-minilm-l6-v2 | text | embeddings | 0.005 | 0.000 | 512 |
| sentence-transformers/all-mpnet-base-v2 | text | embeddings | 0.005 | 0.000 | 512 |
| sentence-transformers/multi-qa-mpnet-base-dot-v1 | text | embeddings | 0.005 | 0.000 | 512 |
| sentence-transformers/paraphrase-minilm-l6-v2 | text | embeddings | 0.005 | 0.000 | 512 |
| stepfun/step-3.5-flash | text | text | 0.100 | 0.300 | 262144 |
| stepfun/step-3.7-flash | text, image, video | text | 0.200 | 1.150 | 262144 |
| stepfun/step-5-preview | text, image, video | text | 1.000 | 2.700 | 1000000 |
| tencent/hunyuan-a13b-instruct | text | text | 0.140 | 0.570 | 131072 |
| tencent/hy-mt2-1.8b | text | text | 0.044 | 0.177 | 8192 |
| tencent/hy-mt2-30b-a3b | text | text | 0.074 | 0.295 | 8192 |
| tencent/hy-mt2-7b | text | text | 0.074 | 0.295 | 8192 |
| tencent/hy3 | text | text | 0.083 | 0.330 | 262144 |
| tencent/hy3-preview | text | text | 0.180 | 0.600 | 262144 |
| tencent/hy4 | text, image | text | 0.417 | 1.250 | 1048576 |
| tencent/hy4-preview | text | text | 0.751 | 2.251 | 1048576 |
| thedrummer/cydonia-24b-v4.1 | text | text | 0.300 | 0.500 | 131072 |
| thedrummer/skyfall-36b-v2 | text | text | 0.550 | 0.800 | 32768 |
| thedrummer/unslopnemo-12b | text | text | 0.400 | 0.400 | 1024000 |
| thenlper/gte-base | text | embeddings | 0.005 | 0.000 | 512 |
| thenlper/gte-large | text | embeddings | 0.010 | 0.000 | 512 |
| thinkingmachines/inkling | text, image, audio | text | 1.000 | 4.050 | 524288 |
| thinkingmachines/inkling-2-small | text, image | text | 0.300 | 1.000 | 1048576 |
| thinkingmachines/inkling-2-small:free | text, image | text | 0.000 | 0.000 | 1048576 |
| thinkingmachines/inkling-small | text, image, audio | text | 0.450 | 1.200 | 524288 |
| typesafe/jev-router | audio, file, image, text, video | text | -1000000.000 | -1000000.000 | 1000000 |
| unbiased/pareto-26.10 | text, image | text | 0.800 | 3.200 | 1048576 |
| unbiased/pareto-26.10-preview | text, image | text | 0.800 | 3.200 | 1048576 |
| unbiased/pareto-26.9 | text, image | text | 2.500 | 7.500 | 262144 |
| undi95/remm-slerp-l2-13b | text | text | 0.300 | 0.500 | 6144 |
| upstage/solar-mini4 | text | text | 0.050 | 0.200 | 524288 |
| upstage/solar-pro4 | text | text | 0.150 | 0.600 | 524288 |
| writer/palmyra-x5 | text | text | 0.600 | 6.000 | 1040000 |
| x-ai/grok-4.20 | text, image, file | text | 1.250 | 2.500 | 2000000 |
| x-ai/grok-4.20-multi-agent | text, image, file | text | 1.250 | 2.500 | 2000000 |
| x-ai/grok-4.3 | text, image, file | text | 1.250 | 2.500 | 1000000 |
| x-ai/grok-4.5 | text, image, file | text | 2.000 | 6.000 | 500000 |
| x-ai/grok-4.6 | text, image, file | text | 2.000 | 6.000 | 500000 |
| x-ai/grok-4.7 | text, image, file | text | 2.000 | 6.000 | 500000 |
| x-ai/grok-build-0.1 | text, image, file | text | 1.000 | 2.000 | 256000 |
| xiaomi/mimo-v2.5 | text, audio, image, video | text | 0.400 | 2.000 | 1000000 |
| xiaomi/mimo-v2.5-pro | text | text | 0.435 | 0.870 | 1024000 |
| xiaomi/mimo-v2.6-flash | text, image, video, audio | text | 0.140 | 0.280 | 1050000 |
| xiaomi/mimo-v2.6-pro | text, image, video, audio | text | 0.435 | 0.870 | 1050000 |
| xiaomi/mimo-v2.6-pro-ultraspeed | text, image, video, audio | text | 4.350 | 8.700 | 1048576 |
| z-ai/glm-4.5 | text | text | 0.600 | 2.200 | 131072 |
| z-ai/glm-4.5-air | text | text | 0.200 | 1.100 | 131072 |
| z-ai/glm-4.5v | text, image | text | 0.600 | 1.800 | 65536 |
| z-ai/glm-4.6 | text | text | 0.500 | 2.000 | 204800 |
| z-ai/glm-4.6v | image, text, video | text | 0.300 | 0.900 | 131072 |
| z-ai/glm-4.7 | text | text | 0.600 | 2.200 | 204800 |
| z-ai/glm-4.7-flash | text | text | 0.061 | 0.400 | 200000 |
| z-ai/glm-5 | text | text | 1.000 | 3.200 | 204800 |
| z-ai/glm-5-turbo | text | text | 1.200 | 4.000 | 202752 |
| z-ai/glm-5.1 | text | text | 1.400 | 4.400 | 204800 |
| z-ai/glm-5.2 | text | text | 0.007 | 6.800 | 1048576 |
| z-ai/glm-5.3 | text | text | 0.084 | 3.600 | 1048576 |
| z-ai/glm-5.3-flash | text, image, video | text | 0.040 | 0.078 | 1048576 |
| z-ai/glm-5.3-flashx | text, image, video | text | 0.370 | 1.250 | 1048576 |
| z-ai/glm-5.3-flashx-legal | text, image, video | text | 0.370 | 1.250 | 1048576 |
| z-ai/glm-5.3-prime | text | text | 2.800 | 8.800 | 1000000 |
| z-ai/glm-5v-turbo | image, text, video | text | 1.200 | 4.000 | 202752 |