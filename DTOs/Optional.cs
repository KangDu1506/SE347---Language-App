using System.Text.Json;
using System.Text.Json.Serialization;

namespace SE347.DTOs
{
    /// <summary>
    /// Giá trị của một trường trong body PATCH: phân biệt "không gửi" (HasValue = false)
    /// với "gửi null" (HasValue = true, Value = null).
    /// System.Text.Json chỉ gọi converter khi trường có mặt trong JSON, nên trường vắng mặt giữ default.
    /// </summary>
    [JsonConverter(typeof(OptionalJsonConverterFactory))]
    public readonly struct Optional<T>
    {
        public Optional(T value)
        {
            HasValue = true;
            Value = value;
        }

        public bool HasValue { get; }

        public T Value { get; }

        public static implicit operator Optional<T>(T value) => new(value);
    }

    public sealed class OptionalJsonConverterFactory : JsonConverterFactory
    {
        public override bool CanConvert(Type typeToConvert) =>
            typeToConvert.IsGenericType && typeToConvert.GetGenericTypeDefinition() == typeof(Optional<>);

        public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
            (JsonConverter)Activator.CreateInstance(
                typeof(OptionalJsonConverter<>).MakeGenericType(typeToConvert.GetGenericArguments()[0]))!;

        private sealed class OptionalJsonConverter<T> : JsonConverter<Optional<T>>
        {
            // Cần true để "field": null cũng đi qua Read (thành Optional có giá trị null)
            public override bool HandleNull => true;

            // Gọi thẳng converter của T (không qua JsonSerializer.Deserialize) để lỗi sai kiểu
            // giữ được Path của trường, ví dụ "$.dailyGoalXp"
            public override Optional<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                new(((JsonConverter<T>)options.GetConverter(typeof(T))).Read(ref reader, typeof(T), options)!);

            public override void Write(Utf8JsonWriter writer, Optional<T> value, JsonSerializerOptions options)
            {
                if (value.HasValue)
                {
                    JsonSerializer.Serialize(writer, value.Value, options);
                }
                else
                {
                    writer.WriteNullValue();
                }
            }
        }
    }
}
